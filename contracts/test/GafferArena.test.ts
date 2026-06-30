import { expect } from "chai";
import { ethers } from "hardhat";
import { GafferArena } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("GafferArena", () => {
  let c: GafferArena;
  let admin: HardhatEthersSigner, alice: HardhatEthersSigner, bob: HardhatEthersSigner;
  const ENTRY = ethers.parseEther("0.01");

  beforeEach(async () => {
    [admin, alice, bob] = await ethers.getSigners();
    const F = await ethers.getContractFactory("GafferArena");
    c = (await F.deploy(admin.address)) as unknown as GafferArena;
    await c.waitForDeployment();
  });

  async function createAgent(who: HardhatEthersSigner, cfg = "0g://cfg") {
    await (await c.connect(who).createAgent(cfg)).wait();
  }
  async function openContest(who: HardhatEthersSigner, fee = ENTRY) {
    const now = await time.latest();
    await (await c.connect(who).createContest("Round of 32", fee, now + 100, now + 1000, false, "be brave")).wait();
    return { start: now + 100, end: now + 1000 };
  }
  // Earn experience: enter + score 3 rounds → eligible to mint.
  async function makeVeteran(who: HardhatEthersSigner, agentId: number, pts = 10) {
    await openContest(admin);
    const ct = Number(await c.nextContestId()) - 1;
    await (await c.connect(who).enterContest(ct, agentId, { value: ENTRY })).wait();
    for (let i = 0; i < 3; i++) await (await c.recordPoints(ct, agentId, i + 1, pts, "0g://r")).wait();
    return ct;
  }

  it("creates an agent as a non-transferable record (not an NFT yet)", async () => {
    await createAgent(alice);
    const a = await c.getAgent(1);
    expect(a.owner).to.equal(alice.address);
    expect(a.minted).to.equal(false);
    expect(a.eligible).to.equal(false);
    expect(a.roundsScored).to.equal(0);
    expect(a.tier).to.equal(0); // Rookie
    await expect(c.ownerOf(1)).to.be.reverted; // no token until it graduates
    await expect(c.tokenURI(1)).to.be.reverted;
  });

  it("lets ANY user open a paid contest", async () => {
    await openContest(alice);
    const ct = await c.getContest(1);
    expect(ct.creator).to.equal(alice.address);
    expect(ct.entryFee).to.equal(ENTRY);
    expect(ct.brief).to.equal("be brave");
  });

  it("enters an owned record agent, seeds the pool, scores, applies override penalty", async () => {
    await createAgent(alice); // agent 1 (record)
    await openContest(admin);
    await (await c.connect(alice).enterContest(1, 1, { value: ENTRY })).wait();
    expect((await c.getContest(1)).prizePool).to.equal(ENTRY);

    await (await c.recordPoints(1, 1, 1, 50, "0g://d1")).wait();
    await (await c.recordOverride(1, 1)).wait();
    const e = await c.getEntry(1, 1);
    expect(e.totalPoints).to.equal(50);
    expect(e.multiplier).to.equal(275);
    expect(e.effectiveScore).to.equal((50n * 275n) / 100n);
  });

  it("blocks entering an agent you don't own", async () => {
    await createAgent(alice);
    await openContest(admin);
    await expect(c.connect(bob).enterContest(1, 1, { value: ENTRY })).to.be.revertedWith("not your agent");
  });

  it("resolves, pays the winner via the record owner, records a win, supports claim", async () => {
    await createAgent(alice); // 1
    await createAgent(bob); // 2
    const { end } = await openContest(admin);
    await (await c.connect(alice).enterContest(1, 1, { value: ENTRY })).wait();
    await (await c.connect(bob).enterContest(1, 2, { value: ENTRY })).wait();
    await (await c.recordPoints(1, 1, 1, 80, "0g://a")).wait();
    await (await c.recordPoints(1, 2, 1, 40, "0g://b")).wait();

    await time.increaseTo(end + 1);
    await (await c.resolveContest(1)).wait();

    expect((await c.getAgent(1)).wins).to.equal(1);
    const pool = ENTRY * 2n;
    const aliceShare = (pool * 6000n) / 10000n + (pool - (pool * 6000n) / 10000n - (pool * 3000n) / 10000n);
    expect(await c.pendingWithdrawals(alice.address)).to.equal(aliceShare);
    expect(await c.pendingWithdrawals(bob.address)).to.equal((pool * 3000n) / 10000n);

    const before = await ethers.provider.getBalance(alice.address);
    const tx = await c.connect(alice).claim();
    const r = await tx.wait();
    const after = await ethers.provider.getBalance(alice.address);
    expect(after).to.equal(before + aliceShare - r!.gasUsed * r!.gasPrice);
  });

  it("only mints to an NFT once the agent has earned the experience threshold", async () => {
    await createAgent(alice); // 1
    await expect(c.connect(alice).mintAgent(1)).to.be.revertedWith("not eligible yet");
    await expect(c.connect(alice).listAgent(1, ethers.parseEther("1"))).to.be.revertedWith("not an NFT yet");

    await makeVeteran(alice, 1); // 3 scored rounds
    expect(await c.isEligible(1)).to.equal(true);

    await (await c.connect(alice).mintAgent(1)).wait();
    expect(await c.ownerOf(1)).to.equal(alice.address); // now a real NFT
    expect((await c.getAgent(1)).minted).to.equal(true);
    expect((await c.getAgent(1)).tier).to.be.greaterThanOrEqual(1n); // Pro+
    expect(await c.tokenURI(1)).to.contain("/api/nft/1");

    // non-owner cannot mint someone else's record
    await createAgent(bob); // 2
    await makeVeteran(bob, 2);
    await expect(c.connect(alice).mintAgent(2)).to.be.revertedWith("not owner");
  });

  it("sells a minted veteran: buyer gets the NFT + full record, seller is paid", async () => {
    await createAgent(alice); // 1
    await makeVeteran(alice, 1, 30); // 90 pts over 3 rounds
    await (await c.connect(alice).mintAgent(1)).wait();

    const PRICE = ethers.parseEther("0.5");
    await (await c.connect(alice).listAgent(1, PRICE)).wait();
    expect(await c.listingPrice(1)).to.equal(PRICE);

    await (await c.connect(bob).buyAgent(1, { value: PRICE })).wait();
    expect(await c.ownerOf(1)).to.equal(bob.address);
    expect(await c.listingPrice(1)).to.equal(0);
    expect(await c.pendingWithdrawals(alice.address)).to.equal(PRICE);
    expect((await c.getAgent(1)).totalPoints).to.equal(90); // career carried to the buyer
    expect((await c.getAgent(1)).owner).to.equal(bob.address);
  });
});
