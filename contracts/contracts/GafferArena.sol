// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title GafferArena
 * @notice An onchain arena of AI football managers ("gaffers") on 0G — agents that EARN their way
 *         to becoming ownable, tradeable NFTs.
 *
 * Lifecycle (signing a manager who proves himself, then becomes a transferable asset):
 *   1. createAgent()  — a gaffer is born as a non-transferable RECORD (config on 0G). Not an NFT.
 *   2. it enters contests and is scored each round on 0G-verifiable AI decisions, building a
 *      verifiable career (rounds scored, points, wins, autonomy streak).
 *   3. once it crosses the experience threshold it becomes ELIGIBLE, and the owner can mintAgent()
 *      to turn it into a real ERC-721 NFT — now tradeable in our marketplace AND anywhere ERC-721
 *      is supported (tokenURI carries its name + career). A raw record can never be transferred.
 *
 * The Autonomy Multiplier: each entry starts at 3.00x; every override reduces it. Effective score
 * = points * multiplier. Prizes pay on effective score. Trust-minimisation comes from 0G: every
 * score is backed by a decisionHash (0G Storage root + DA proof) anyone can verify.
 */
contract GafferArena is ERC721, AccessControl, ReentrancyGuard, Pausable {
    using Strings for uint256;

    bytes32 public constant RESOLVER_ROLE = keccak256("RESOLVER_ROLE");

    uint256 public constant MULTIPLIER_MAX = 300;
    uint256 public constant MULTIPLIER_MIN = 100;
    uint256 public constant OVERRIDE_PENALTY = 25;

    uint256 public constant PRIZE_FIRST = 6000;
    uint256 public constant PRIZE_SECOND = 3000;
    uint256 public constant PRIZE_THIRD = 1000;

    // A gaffer must have scored at least this many rounds before it's eligible to be minted into a
    // tradeable NFT — you can only sell a proven veteran, never a blank shell.
    uint256 public constant TRADEABLE_MIN_ROUNDS = 3;

    struct Agent {
        address owner;          // record owner before mint; after mint, ERC-721 ownerOf is source of truth
        bool minted;            // has it graduated into a real NFT?
        string configHash;      // 0G Storage hash of the manager's brain/strategy
        uint256 contestsEntered;
        uint256 roundsScored;   // experience (drives tier + mint eligibility)
        uint256 totalPoints;
        uint256 totalEffective;
        uint256 wins;
        uint256 overrideCount;
        uint256 createdAt;
    }

    uint256 public nextAgentId = 1;
    mapping(uint256 => Agent) private _agents;

    struct Contest {
        uint256 id;
        string name;
        uint256 prizePool;
        uint256 entryFee;
        uint256 startTime;
        uint256 endTime;
        bool resolved;
        address creator;
        bool isPrivate;
        string brief;
        uint256[] participants;
    }

    struct Entry { bool active; uint256 totalPoints; uint256 overrideCount; uint256 entryTime; }

    uint256 public nextContestId = 1;
    mapping(uint256 => Contest) private _contests;
    mapping(uint256 => mapping(uint256 => Entry)) private _entries;

    mapping(uint256 => uint256) public listingPrice; // agentId => price (0 = not listed)
    mapping(address => uint256) public pendingWithdrawals;

    string private _base = "https://gafferai.vercel.app/api/nft/";

    event AgentCreated(uint256 indexed agentId, address indexed owner, string configHash);
    event AgentMinted(uint256 indexed agentId, address indexed owner); // graduated to a tradeable NFT
    event AgentConfigUpdated(uint256 indexed agentId, string configHash);
    event ContestCreated(uint256 indexed contestId, address indexed creator, string name, uint256 entryFee, bool isPrivate, uint256 startTime, uint256 endTime);
    event AgentEntered(uint256 indexed contestId, uint256 indexed agentId, address indexed owner, uint256 entryFee);
    event PointsRecorded(uint256 indexed contestId, uint256 indexed agentId, uint256 indexed matchId, uint256 points, string decisionHash);
    event OverrideRecorded(uint256 indexed contestId, uint256 indexed agentId, uint256 newOverrideCount);
    event ContestResolved(uint256 indexed contestId, uint256[] winners, uint256[] payouts);
    event AgentListed(uint256 indexed agentId, uint256 price);
    event AgentUnlisted(uint256 indexed agentId);
    event AgentSold(uint256 indexed agentId, address indexed from, address indexed to, uint256 price);
    event Withdrawal(address indexed to, uint256 amount);

    constructor(address admin) ERC721("Gaffer", "GAFFER") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(RESOLVER_ROLE, admin);
    }

    // -------------------------------------------------------------- Agents
    /// @notice Create a gaffer — a non-transferable record. It must earn its NFT status by playing.
    function createAgent(string calldata configHash) external whenNotPaused returns (uint256 agentId) {
        agentId = nextAgentId++;
        Agent storage a = _agents[agentId];
        a.owner = msg.sender;
        a.configHash = configHash;
        a.createdAt = block.timestamp;
        emit AgentCreated(agentId, msg.sender, configHash);
    }

    /// @notice Effective owner of an agent (record owner pre-mint, ERC-721 owner once minted).
    function agentOwner(uint256 agentId) public view returns (address) {
        return _agents[agentId].minted ? ownerOf(agentId) : _agents[agentId].owner;
    }

    /// @notice An agent is eligible to become a tradeable NFT once it has a real record.
    function isEligible(uint256 agentId) public view returns (bool) {
        return _agents[agentId].roundsScored >= TRADEABLE_MIN_ROUNDS;
    }

    /// @notice Graduate an eligible agent into a real ERC-721 NFT — now tradeable everywhere.
    function mintAgent(uint256 agentId) external whenNotPaused {
        Agent storage a = _agents[agentId];
        require(a.owner == msg.sender, "not owner");
        require(!a.minted, "already minted");
        require(isEligible(agentId), "not eligible yet");
        a.minted = true;
        _safeMint(msg.sender, agentId);
        emit AgentMinted(agentId, msg.sender);
    }

    function updateAgentConfig(uint256 agentId, string calldata configHash) external {
        require(agentOwner(agentId) == msg.sender, "not owner");
        require(listingPrice[agentId] == 0, "listed");
        _agents[agentId].configHash = configHash;
        emit AgentConfigUpdated(agentId, configHash);
    }

    // -------------------------------------------------------------- Contests
    function createContest(
        string calldata name,
        uint256 entryFee,
        uint256 startTime,
        uint256 endTime,
        bool isPrivate,
        string calldata brief
    ) external whenNotPaused returns (uint256 contestId) {
        require(endTime > startTime, "bad window");
        require(endTime > block.timestamp, "ends in past");
        contestId = nextContestId++;
        Contest storage c = _contests[contestId];
        c.id = contestId;
        c.name = name;
        c.entryFee = entryFee;
        c.startTime = startTime;
        c.endTime = endTime;
        c.creator = msg.sender;
        c.isPrivate = isPrivate;
        c.brief = brief;
        emit ContestCreated(contestId, msg.sender, name, entryFee, isPrivate, startTime, endTime);
    }

    function enterContest(uint256 contestId, uint256 agentId) external payable whenNotPaused nonReentrant {
        Contest storage c = _contests[contestId];
        require(c.id != 0, "no contest");
        require(agentOwner(agentId) == msg.sender, "not your agent");
        require(block.timestamp < c.startTime, "entries closed");
        require(msg.value == c.entryFee, "wrong entry fee");

        Entry storage e = _entries[contestId][agentId];
        require(!e.active, "already entered");
        e.active = true;
        e.entryTime = block.timestamp;
        c.prizePool += msg.value;
        c.participants.push(agentId);
        _agents[agentId].contestsEntered += 1;
        emit AgentEntered(contestId, agentId, msg.sender, msg.value);
    }

    // -------------------------------------------------------------- Resolver
    function recordPoints(uint256 contestId, uint256 agentId, uint256 matchId, uint256 points, string calldata decisionHash)
        external onlyRole(RESOLVER_ROLE)
    {
        Entry storage e = _entries[contestId][agentId];
        require(e.active, "not entered");
        require(!_contests[contestId].resolved, "resolved");
        e.totalPoints += points;
        Agent storage a = _agents[agentId];
        a.totalPoints += points;
        a.roundsScored += 1;
        emit PointsRecorded(contestId, agentId, matchId, points, decisionHash);
    }

    function recordOverride(uint256 contestId, uint256 agentId) external onlyRole(RESOLVER_ROLE) {
        Entry storage e = _entries[contestId][agentId];
        require(e.active, "not entered");
        require(!_contests[contestId].resolved, "resolved");
        e.overrideCount += 1;
        _agents[agentId].overrideCount += 1;
        emit OverrideRecorded(contestId, agentId, e.overrideCount);
    }

    // -------------------------------------------------------------- Scoring views
    function getMultiplier(uint256 contestId, uint256 agentId) public view returns (uint256) {
        uint256 penalty = _entries[contestId][agentId].overrideCount * OVERRIDE_PENALTY;
        if (penalty >= MULTIPLIER_MAX - MULTIPLIER_MIN) return MULTIPLIER_MIN;
        return MULTIPLIER_MAX - penalty;
    }

    function getEffectiveScore(uint256 contestId, uint256 agentId) public view returns (uint256) {
        return (_entries[contestId][agentId].totalPoints * getMultiplier(contestId, agentId)) / 100;
    }

    function level(uint256 agentId) public view returns (uint256) {
        Agent storage a = _agents[agentId];
        if (a.roundsScored >= 24 || a.wins >= 3) return 3;
        if (a.roundsScored >= 12 || a.wins >= 1) return 2;
        if (a.roundsScored >= TRADEABLE_MIN_ROUNDS) return 1;
        return 0;
    }

    // -------------------------------------------------------------- Resolution & payouts
    function resolveContest(uint256 contestId) external onlyRole(RESOLVER_ROLE) nonReentrant {
        Contest storage c = _contests[contestId];
        require(c.id != 0, "no contest");
        require(block.timestamp >= c.endTime, "not ended");
        require(!c.resolved, "already resolved");
        c.resolved = true;

        uint256 n = c.participants.length;
        uint256[] memory winners = new uint256[](n < 3 ? n : 3);
        uint256[] memory payouts = new uint256[](winners.length);
        if (n == 0) { emit ContestResolved(contestId, winners, payouts); return; }

        uint256[3] memory top;
        uint256[3] memory topScore;
        for (uint256 i = 0; i < n; i++) {
            uint256 agentId = c.participants[i];
            uint256 score = getEffectiveScore(contestId, agentId);
            _agents[agentId].totalEffective += score;
            for (uint256 r = 0; r < 3; r++) {
                if (score > topScore[r]) {
                    for (uint256 k = 2; k > r; k--) { topScore[k] = topScore[k - 1]; top[k] = top[k - 1]; }
                    topScore[r] = score; top[r] = agentId; break;
                }
            }
        }
        if (top[0] != 0) _agents[top[0]].wins += 1;

        if (c.prizePool > 0) {
            uint256[3] memory splitBps = [PRIZE_FIRST, PRIZE_SECOND, PRIZE_THIRD];
            uint256 pool = c.prizePool;
            uint256 distributed;
            for (uint256 r = 0; r < winners.length; r++) {
                if (top[r] == 0) break;
                uint256 amount = (pool * splitBps[r]) / 10000;
                winners[r] = top[r];
                payouts[r] = amount;
                pendingWithdrawals[agentOwner(top[r])] += amount;
                distributed += amount;
            }
            uint256 remainder = pool - distributed;
            if (remainder > 0 && top[0] != 0) { pendingWithdrawals[agentOwner(top[0])] += remainder; payouts[0] += remainder; }
        } else {
            for (uint256 r = 0; r < winners.length; r++) winners[r] = top[r];
        }
        emit ContestResolved(contestId, winners, payouts);
    }

    function claim() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "nothing to claim");
        pendingWithdrawals[msg.sender] = 0;
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "transfer failed");
        emit Withdrawal(msg.sender, amount);
    }

    // -------------------------------------------------------------- Marketplace (NFTs only)
    function listAgent(uint256 agentId, uint256 price) external {
        require(_agents[agentId].minted, "not an NFT yet");
        require(ownerOf(agentId) == msg.sender, "not owner");
        require(price > 0, "price 0");
        listingPrice[agentId] = price;
        emit AgentListed(agentId, price);
    }

    function unlistAgent(uint256 agentId) external {
        require(ownerOf(agentId) == msg.sender, "not owner");
        require(listingPrice[agentId] > 0, "not listed");
        listingPrice[agentId] = 0;
        emit AgentUnlisted(agentId);
    }

    function buyAgent(uint256 agentId) external payable nonReentrant whenNotPaused {
        uint256 price = listingPrice[agentId];
        require(price > 0, "not listed");
        require(msg.value == price, "wrong price");
        address seller = ownerOf(agentId);
        require(seller != msg.sender, "own agent");
        listingPrice[agentId] = 0;
        pendingWithdrawals[seller] += msg.value;
        _safeTransfer(seller, msg.sender, agentId, "");
        emit AgentSold(agentId, seller, msg.sender, price);
    }

    /// @dev Clear any listing on transfer. (Only minted NFTs can be transferred at all.)
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        if (listingPrice[tokenId] != 0) listingPrice[tokenId] = 0;
        return super._update(to, tokenId, auth);
    }

    // -------------------------------------------------------------- Metadata
    function setBaseURI(string calldata base) external onlyRole(DEFAULT_ADMIN_ROLE) { _base = base; }

    function tokenURI(uint256 agentId) public view override returns (string memory) {
        _requireOwned(agentId); // only minted agents have a tokenURI
        return string.concat(_base, agentId.toString());
    }

    // -------------------------------------------------------------- Read helpers
    function getAgent(uint256 agentId)
        external view
        returns (
            address owner,
            string memory configHash,
            uint256 contestsEntered,
            uint256 roundsScored,
            uint256 totalPoints,
            uint256 totalEffective,
            uint256 wins,
            uint256 overrideCount,
            uint256 tier,
            bool eligible,
            bool minted,
            uint256 price
        )
    {
        Agent storage a = _agents[agentId];
        return (
            agentOwner(agentId),
            a.configHash,
            a.contestsEntered,
            a.roundsScored,
            a.totalPoints,
            a.totalEffective,
            a.wins,
            a.overrideCount,
            level(agentId),
            isEligible(agentId),
            a.minted,
            listingPrice[agentId]
        );
    }

    function getContest(uint256 contestId)
        external view
        returns (uint256 id, string memory name, uint256 prizePool, uint256 entryFee, uint256 startTime, uint256 endTime, bool resolved, uint256 participantCount, address creator, bool isPrivate, string memory brief)
    {
        Contest storage c = _contests[contestId];
        return (c.id, c.name, c.prizePool, c.entryFee, c.startTime, c.endTime, c.resolved, c.participants.length, c.creator, c.isPrivate, c.brief);
    }

    function getParticipants(uint256 contestId) external view returns (uint256[] memory) {
        return _contests[contestId].participants;
    }

    function getEntry(uint256 contestId, uint256 agentId)
        external view
        returns (bool active, uint256 totalPoints, uint256 overrideCount, uint256 multiplier, uint256 effectiveScore, uint256 entryTime)
    {
        Entry storage e = _entries[contestId][agentId];
        return (e.active, e.totalPoints, e.overrideCount, getMultiplier(contestId, agentId), getEffectiveScore(contestId, agentId), e.entryTime);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
