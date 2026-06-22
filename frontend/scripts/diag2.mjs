import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage();
const errs = [];
p.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0,200)); });
p.on("pageerror", (e) => errs.push("PAGEERR: " + e.message.slice(0,200)));
await p.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 30000 });
await p.waitForTimeout(3500);
// click Sign in
const btn = p.locator("header button:has-text('Sign in')").first();
console.log("sign-in visible:", await btn.count());
await btn.click().catch((e) => console.log("click err:", e.message));
await p.waitForTimeout(4000);
// look for the Privy modal (iframe or modal text)
const iframes = p.frames().map((f) => f.url()).filter((u) => /privy/i.test(u));
const modalText = await p.locator("text=/email|wallet|continue|log in|sign in to/i").count();
console.log("privy iframes:", iframes.length, iframes.slice(0,2));
console.log("modal-ish elements:", modalText);
console.log("console errors:", errs.length);
errs.slice(0,8).forEach((e) => console.log("  •", e));
await b.close();
