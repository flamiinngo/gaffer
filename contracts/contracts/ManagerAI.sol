// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title ManagerAI
 * @notice Core contest contract for ManagerAI — an AI-managed fantasy World Cup on 0G Chain.
 *
 * Users deploy an autonomous AI Manager (config lives on 0G Storage, referenced by `configHash`).
 * The AI plays matches on their behalf. Every match the backend agent — holding RESOLVER_ROLE —
 * records points and the 0G DA proof hash of the decision that produced them.
 *
 * The Autonomy Multiplier: a manager starts at 3.00x. Every human override the agent reports
 * reduces the multiplier. Effective score = totalPoints * multiplier. Prizes are paid on
 * effective score, so the most trustworthy autonomous AI earns the most.
 *
 * There is no Chainlink dependency. Trust-minimisation comes from 0G: every score the resolver
 * writes is backed by a `decisionHash` pointing to a 0G DA proof + 0G Storage blob that anyone
 * can independently verify. The resolver cannot fabricate points without leaving a public,
 * verifiable trail onchain and on 0G.
 */
contract ManagerAI is AccessControl, ReentrancyGuard, Pausable {
    bytes32 public constant RESOLVER_ROLE = keccak256("RESOLVER_ROLE");

    // Multiplier is in basis points of 1x. 100 = 1.00x, 300 = 3.00x.
    uint256 public constant MULTIPLIER_MAX = 300;
    uint256 public constant MULTIPLIER_MIN = 100;
    uint256 public constant OVERRIDE_PENALTY = 25; // each override costs 0.25x

    // Prize split for the top 3 effective scorers, in basis points of the pool.
    uint256 public constant PRIZE_FIRST = 6000; // 60%
    uint256 public constant PRIZE_SECOND = 3000; // 30%
    uint256 public constant PRIZE_THIRD = 1000; // 10%

    struct Manager {
        address owner;
        string configHash; // 0G Storage hash of the manager's strategy config
        uint256 totalPoints;
        uint256 overrideCount;
        uint256 entryTime;
        bool active;
    }

    struct Contest {
        uint256 id;
        string name;
        uint256 prizePool;
        uint256 entryFee;
        uint256 startTime;
        uint256 endTime;
        bool resolved;
        address[] participants;
    }

    uint256 public nextContestId = 1;
    mapping(uint256 => Contest) private _contests;
    // contestId => manager owner => Manager
    mapping(uint256 => mapping(address => Manager)) private _managers;
    // pull-payment ledger
    mapping(address => uint256) public pendingWithdrawals;

    event ContestCreated(uint256 indexed contestId, string name, uint256 entryFee, uint256 startTime, uint256 endTime);
    event ManagerEntered(uint256 indexed contestId, address indexed owner, string configHash, uint256 entryFee);
    event ConfigUpdated(uint256 indexed contestId, address indexed owner, string configHash);
    event PointsRecorded(
        uint256 indexed contestId,
        address indexed owner,
        uint256 indexed matchId,
        uint256 points,
        string decisionHash
    );
    event OverrideRecorded(uint256 indexed contestId, address indexed owner, uint256 newOverrideCount);
    event ContestResolved(uint256 indexed contestId, address[] winners, uint256[] payouts);
    event Withdrawal(address indexed to, uint256 amount);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(RESOLVER_ROLE, admin);
    }

    // ---------------------------------------------------------------------
    // Contest lifecycle
    // ---------------------------------------------------------------------

    function createContest(
        string calldata name,
        uint256 entryFee,
        uint256 startTime,
        uint256 endTime
    ) external onlyRole(DEFAULT_ADMIN_ROLE) returns (uint256 contestId) {
        require(endTime > startTime, "bad window");
        require(endTime > block.timestamp, "ends in past");

        contestId = nextContestId++;
        Contest storage c = _contests[contestId];
        c.id = contestId;
        c.name = name;
        c.entryFee = entryFee;
        c.startTime = startTime;
        c.endTime = endTime;

        emit ContestCreated(contestId, name, entryFee, startTime, endTime);
    }

    /**
     * @notice Deploy your AI Manager into a contest. Pays the entry fee, which seeds the pool.
     * @param contestId the contest to enter
     * @param configHash 0G Storage hash of your manager's strategy config
     */
    function enterContest(uint256 contestId, string calldata configHash)
        external
        payable
        whenNotPaused
        nonReentrant
    {
        Contest storage c = _contests[contestId];
        require(c.id != 0, "no contest");
        require(block.timestamp < c.startTime, "entries closed");
        require(msg.value == c.entryFee, "wrong entry fee");

        Manager storage m = _managers[contestId][msg.sender];
        require(!m.active, "already entered");

        m.owner = msg.sender;
        m.configHash = configHash;
        m.entryTime = block.timestamp;
        m.active = true;

        c.prizePool += msg.value;
        c.participants.push(msg.sender);

        emit ManagerEntered(contestId, msg.sender, configHash, msg.value);
    }

    /// @notice Update your manager's strategy config hash before the contest starts.
    function updateConfig(uint256 contestId, string calldata configHash) external whenNotPaused {
        Manager storage m = _managers[contestId][msg.sender];
        require(m.active, "not entered");
        require(block.timestamp < _contests[contestId].startTime, "contest started");
        m.configHash = configHash;
        emit ConfigUpdated(contestId, msg.sender, configHash);
    }

    // ---------------------------------------------------------------------
    // Resolver (backend agent) — the oracle role, backed by 0G proofs
    // ---------------------------------------------------------------------

    /**
     * @notice Record fantasy points for a manager for a given match, with the 0G DA proof hash
     *         of the AI decision that produced them. Anyone can verify `decisionHash` on 0G.
     */
    function recordPoints(
        uint256 contestId,
        address owner,
        uint256 matchId,
        uint256 points,
        string calldata decisionHash
    ) external onlyRole(RESOLVER_ROLE) {
        Manager storage m = _managers[contestId][owner];
        require(m.active, "not entered");
        require(!_contests[contestId].resolved, "resolved");
        m.totalPoints += points;
        emit PointsRecorded(contestId, owner, matchId, points, decisionHash);
    }

    /// @notice Report that the human overrode the AI. Reduces their autonomy multiplier.
    function recordOverride(uint256 contestId, address owner) external onlyRole(RESOLVER_ROLE) {
        Manager storage m = _managers[contestId][owner];
        require(m.active, "not entered");
        require(!_contests[contestId].resolved, "resolved");
        m.overrideCount += 1;
        emit OverrideRecorded(contestId, owner, m.overrideCount);
    }

    // ---------------------------------------------------------------------
    // Scoring views
    // ---------------------------------------------------------------------

    /// @notice Multiplier in basis points of 1x (100..300).
    function getMultiplier(uint256 contestId, address owner) public view returns (uint256) {
        Manager storage m = _managers[contestId][owner];
        uint256 penalty = m.overrideCount * OVERRIDE_PENALTY;
        if (penalty >= MULTIPLIER_MAX - MULTIPLIER_MIN) return MULTIPLIER_MIN;
        return MULTIPLIER_MAX - penalty;
    }

    /// @notice Effective score = totalPoints * multiplier / 100.
    function getEffectiveScore(uint256 contestId, address owner) public view returns (uint256) {
        Manager storage m = _managers[contestId][owner];
        return (m.totalPoints * getMultiplier(contestId, owner)) / 100;
    }

    // ---------------------------------------------------------------------
    // Resolution & payouts (pull pattern)
    // ---------------------------------------------------------------------

    /// @notice Resolve a finished contest: rank by effective score, credit top-3 payouts.
    function resolveContest(uint256 contestId) external onlyRole(RESOLVER_ROLE) nonReentrant {
        Contest storage c = _contests[contestId];
        require(c.id != 0, "no contest");
        require(block.timestamp >= c.endTime, "not ended");
        require(!c.resolved, "already resolved");

        c.resolved = true;

        uint256 n = c.participants.length;
        address[] memory winners = new address[](n < 3 ? n : 3);
        uint256[] memory payouts = new uint256[](winners.length);

        if (n == 0 || c.prizePool == 0) {
            emit ContestResolved(contestId, winners, payouts);
            return;
        }

        // Find top-3 by effective score (small N; insertion against a 3-slot board).
        address[3] memory top;
        uint256[3] memory topScore;
        for (uint256 i = 0; i < n; i++) {
            address owner = c.participants[i];
            uint256 score = getEffectiveScore(contestId, owner);
            for (uint256 r = 0; r < 3; r++) {
                if (score > topScore[r]) {
                    // shift down
                    for (uint256 k = 2; k > r; k--) {
                        topScore[k] = topScore[k - 1];
                        top[k] = top[k - 1];
                    }
                    topScore[r] = score;
                    top[r] = owner;
                    break;
                }
            }
        }

        uint256[3] memory splitBps = [PRIZE_FIRST, PRIZE_SECOND, PRIZE_THIRD];
        uint256 pool = c.prizePool;
        uint256 distributed;
        for (uint256 r = 0; r < winners.length; r++) {
            if (top[r] == address(0)) break;
            uint256 amount = (pool * splitBps[r]) / 10000;
            winners[r] = top[r];
            payouts[r] = amount;
            pendingWithdrawals[top[r]] += amount;
            distributed += amount;
        }

        // Any rounding dust or undistributed share (e.g. <3 players) goes to the top scorer.
        uint256 remainder = pool - distributed;
        if (remainder > 0 && winners.length > 0 && winners[0] != address(0)) {
            pendingWithdrawals[winners[0]] += remainder;
            payouts[0] += remainder;
        }

        emit ContestResolved(contestId, winners, payouts);
    }

    /// @notice Withdraw your accumulated winnings.
    function claim() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "nothing to claim");
        pendingWithdrawals[msg.sender] = 0;
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "transfer failed");
        emit Withdrawal(msg.sender, amount);
    }

    // ---------------------------------------------------------------------
    // Read helpers (for frontend)
    // ---------------------------------------------------------------------

    function getContest(uint256 contestId)
        external
        view
        returns (
            uint256 id,
            string memory name,
            uint256 prizePool,
            uint256 entryFee,
            uint256 startTime,
            uint256 endTime,
            bool resolved,
            uint256 participantCount
        )
    {
        Contest storage c = _contests[contestId];
        return (c.id, c.name, c.prizePool, c.entryFee, c.startTime, c.endTime, c.resolved, c.participants.length);
    }

    function getParticipants(uint256 contestId) external view returns (address[] memory) {
        return _contests[contestId].participants;
    }

    function getManager(uint256 contestId, address owner)
        external
        view
        returns (
            string memory configHash,
            uint256 totalPoints,
            uint256 overrideCount,
            uint256 multiplier,
            uint256 effectiveScore,
            uint256 entryTime,
            bool active
        )
    {
        Manager storage m = _managers[contestId][owner];
        return (
            m.configHash,
            m.totalPoints,
            m.overrideCount,
            getMultiplier(contestId, owner),
            getEffectiveScore(contestId, owner),
            m.entryTime,
            m.active
        );
    }

    // ---------------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------------

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
