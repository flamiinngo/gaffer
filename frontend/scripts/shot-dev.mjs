import { chromium } from "playwright";
const b = await chromium.launch();
const p = await (await b.newContext({ viewport:{width:1440,height:900}, deviceScaleFactor:2 })).newPage();
await p.goto("http://localhost:3000", { waitUntil:"networkidle", timeout:30000 });
await p.waitForTimeout(2500);
const dev = p.locator("section", { hasText: "Bring your own agent" }).first();
await dev.scrollIntoViewIfNeeded();
await dev.screenshot({ path: "C:/Users/eobi6/zerocup/frontend/.shots/devcli.png" });
console.log("devcli shot");
// open Privy modal to verify theming
await p.evaluate(() => window.scrollTo(0,0));
await p.locator("header button:has-text('Sign in')").first().click().catch(()=>{});
await p.waitForTimeout(4500);
await p.screenshot({ path: "C:/Users/eobi6/zerocup/frontend/.shots/privy.png" });
console.log("privy shot");
await b.close();
