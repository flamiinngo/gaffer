import { chromium } from "playwright";
const b = await chromium.launch();
const p = await (await b.newContext({ viewport:{width:1440,height:1200}, deviceScaleFactor:2 })).newPage();
await p.goto("http://localhost:3000/developers", { waitUntil:"domcontentloaded", timeout:30000 });
await p.waitForTimeout(2500);
await p.screenshot({ path: "C:/Users/eobi6/zerocup/frontend/.shots/developers.png", fullPage: true });
console.log("ok");
await b.close();
