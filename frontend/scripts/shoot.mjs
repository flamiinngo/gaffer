import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE = process.env.BASE || "http://localhost:3000";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", ".shots");
mkdirSync(OUT, { recursive: true });

const PAGES = [
  { name: "home", path: "/" },
  { name: "contest", path: "/contest" },
  { name: "contest-1", path: "/contest/1" },
  { name: "onboard", path: "/onboard" },
  { name: "dashboard", path: "/dashboard" },
  { name: "verify", path: "/verify" },
];

const VIEWS = [
  { tag: "desktop", width: 1440, height: 900 },
  { tag: "mobile", width: 390, height: 844 },
];

const browser = await chromium.launch();
for (const view of VIEWS) {
  const ctx = await browser.newContext({
    viewport: { width: view.width, height: view.height },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  for (const p of PAGES) {
    try {
      await page.goto(BASE + p.path, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(1800); // let animations settle
      await page.screenshot({ path: join(OUT, `${p.name}-${view.tag}.png`), fullPage: true });
      console.log(`shot ${p.name}-${view.tag}`);
    } catch (e) {
      console.error(`FAIL ${p.name}-${view.tag}: ${e.message}`);
    }
  }
  await ctx.close();
}
await browser.close();
console.log("done →", OUT);
