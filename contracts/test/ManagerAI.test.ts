import { expect } from "chai";
import { ethers } from "hardhat";
import { ManagerAI } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("ManagerAI", () => {
  let contract: ManagerAI;
  let admin: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;
  let carol: HardhatEthersSigner;

  const ENTRY = ethers.parseEther("0.01");

  beforeEach(async () => {
    [admin, alice, bob, carol] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("ManagerAI");
    contract = (await Factory.deploy(admin.address)) as unknown as ManagerAI;
    await contract.waitForDeployment();
  });

  async function freshContest() {
    const now = await time.latest();
    const start = now + 100;
    const end = start + 1000;
    const tx = await contract.createContest("World Cup 2026 — Group Stage", ENTRY, start, end);
    await tx.wait();
    return { id: 1n, start, end };
  }

  it("creates a contest", async () => {
    await freshContest();
    const c = await contract.getContest(1);
    expect(c.name).to.equal("World Cup 2026 — Group Stage");
    expect(c.entryFee).to.equal(ENTRY);
    expect(c.resolved).to.equal(false);
  });

  it("lets managers enter and seeds the pool", async () => {
    await freshContest();
    await contract.connect(alice).enterContest(1, "0g://config-alice", { value: ENTRY });
    await contract.connect(bob).enterContest(1, "0g://config-bob", { value: ENTRY });

    const c = await contract.getContest(1);
    expect(c.prizePool).to.equal(ENTRY * 2n);
    expect(c.participantCount).to.equal(2n);

    const m = await contract.getManager(1, alice.address);
    expect(m.configHash).to.equal("0g://config-alice");
    expect(m.active).to.equal(true);
    expect(m.multiplier).to.equal(300n); // starts at 3.00x
  });

  it("rejects wrong entry fee and double entry", async () => {
    await freshContest();
    await expect(
      contract.connect(alice).enterContest(1, "x", { value: ENTRY / 2n })
    ).to.be.revertedWith("wrong entry fee");
    await contract.connect(alice).enterContest(1, "x", { value: ENTRY });
    await expect(
      contract.connect(alice).enterContest(1, "x", { value: ENTRY })
    ).to.be.revertedWith("already entered");
  });

  it("records points only via resolver and applies the multiplier", async () => {
    await freshContest();
    await contract.connect(alice).enterContest(1, "x", { value: ENTRY });

    await expect(
      contract.connect(alice).recordPoints(1, alice.address, 42, 50, "0g://da-proof")
    ).to.be.reverted; // alice lacks RESOLVER_ROLE

    await contract.recordPoints(1, alice.address, 42, 50, "0g://da-proof");
    let m = await contract.getManager(1, alice.address);
    expect(m.totalPoints).to.equal(50n);
    expect(m.effectiveScore).to.equal(150n); // 50 * 3.00

    // one override: 3.00x -> 2.75x
    await contract.recordOverride(1, alice.address);
    m = await contract.getManager(1, alice.address);
    expect(m.multiplier).to.equal(275n);
    expect(m.effectiveScore).to.equal(137n); // floor(50 * 2.75)
  });

  it("floors the multiplier at 1.00x after many overrides", async () => {
    await freshContest();
    await contract.connect(alice).enterContest(1, "x", { value: ENTRY });
    for (let i = 0; i < 20; i++) await contract.recordOverride(1, alice.address);
    const m = await contract.getManager(1, alice.address);
    expect(m.multiplier).to.equal(100n);
  });

  it("resolves a contest and pays top-3 on effective score", async () => {
    const { end } = await freshContest();
    await contract.connect(alice).enterContest(1, "a", { value: ENTRY });
    await contract.connect(bob).enterContest(1, "b", { value: ENTRY });
    await contract.connect(carol).enterContest(1, "c", { value: ENTRY });
    const pool = ENTRY * 3n;

    // Bob scores highest raw but overrides a lot; Alice fully autonomous.
    await contract.recordPoints(1, alice.address, 1, 100, "0g://a"); // eff 300
    await contract.recordPoints(1, bob.address, 1, 130, "0g://b");
    for (let i = 0; i < 8; i++) await contract.recordOverride(1, bob.address); // 3.00 -> 1.00, eff 130
    await contract.recordPoints(1, carol.address, 1, 80, "0g://c"); // eff 240

    await time.increaseTo(end + 1);
    await contract.resolveContest(1);

    // Ranking by effective: alice 300, carol 240, bob 130
    expect(await contract.pendingWithdrawals(alice.address)).to.equal((pool * 6000n) / 10000n);
    expect(await contract.pendingWithdrawals(carol.address)).to.equal((pool * 3000n) / 10000n);
    expect(await contract.pendingWithdrawals(bob.address)).to.equal((pool * 1000n) / 10000n);

    const before = await ethers.provider.getBalance(alice.address);
    const tx = await contract.connect(alice).claim();
    const rcpt = await tx.wait();
    const gas = rcpt!.gasUsed * rcpt!.gasPrice;
    const after = await ethers.provider.getBalance(alice.address);
    expect(after).to.equal(before + (pool * 6000n) / 10000n - gas);
  });

  it("blocks resolution before end and double resolution", async () => {
    const { end } = await freshContest();
    await contract.connect(alice).enterContest(1, "a", { value: ENTRY });
    await expect(contract.resolveContest(1)).to.be.revertedWith("not ended");
    await time.increaseTo(end + 1);
    await contract.resolveContest(1);
    await expect(contract.resolveContest(1)).to.be.revertedWith("already resolved");
  });
});
