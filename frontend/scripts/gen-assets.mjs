import { chromium } from "playwright";

const CAP = `
<svg viewBox="0 0 48 40" xmlns="http://www.w3.org/2000/svg">
  <g>
    <path d="M12 25 C12 13 20.5 8 27 8 C36.5 8 42 15 42 25 Z" fill="#0AE065"/>
    <circle cx="27" cy="8" r="2.1" fill="#0AE065"/>
    <circle cx="27" cy="8" r="0.9" fill="#0A1628" opacity="0.55"/>
    <path d="M16.5 25 C9 24.5 3.5 26.4 2 28.6 C1.7 29.6 5 28.8 9.5 27.7 C13.5 26.7 15.5 26 18 25.4 Z" fill="#00A344"/>
  </g>
</svg>`;

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;600&display=swap" rel="stylesheet">`;

const stadium = `background:#0A1628;background-image:radial-gradient(900px 480px at 30% 20%,rgba(0,200,83,0.16),transparent 60%),radial-gradient(700px 420px at 85% 90%,rgba(255,183,0,0.08),transparent 55%);`;

const logoHTML = `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
*{margin:0;box-sizing:border-box}html,body{width:512px;height:512px}
body{${stadium}display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;font-family:'Bebas Neue',sans-serif}
.cap{width:200px;height:166px;filter:drop-shadow(0 8px 30px rgba(0,200,83,.35))}
.word{font-size:92px;letter-spacing:4px;color:#F0F4FF;line-height:1}.dot{color:#00C853}
</style></head><body><div class="cap">${CAP}</div><div class="word">GAFFER<span class="dot">.</span></div></body></html>`;

const coverHTML = `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
*{margin:0;box-sizing:border-box}html,body{width:1200px;height:630px}
body{${stadium}padding:72px;display:flex;flex-direction:column;justify-content:center;font-family:'Inter',sans-serif;color:#F0F4FF;position:relative;overflow:hidden}
.badge{display:inline-flex;align-items:center;gap:8px;border:1px solid #2A3A5C;background:rgba(26,39,68,.6);border-radius:999px;padding:7px 16px;font-size:18px;color:#7B8FBF;width:max-content}
.dotg{width:9px;height:9px;border-radius:50%;background:#00C853;box-shadow:0 0 10px #00C853}
h1{font-family:'Bebas Neue',sans-serif;font-size:148px;line-height:.9;letter-spacing:2px;margin-top:26px}
.grass{color:#00C853}
p{font-size:30px;color:#7B8FBF;margin-top:22px;max-width:760px;line-height:1.35}
.brand{position:absolute;top:64px;right:72px;display:flex;align-items:center;gap:14px;font-family:'Bebas Neue',sans-serif;font-size:40px;letter-spacing:3px}
.brand .cap{width:60px;height:50px}
.foot{margin-top:34px;font-size:22px;color:#7B8FBF;letter-spacing:1px}
.foot b{color:#FFB700;font-weight:600}
</style></head><body>
<div class="brand"><div class="cap">${CAP}</div>GAFFER<span class="grass">.</span></div>
<div class="badge"><span class="dotg"></span> Live on 0G · World Cup 2026</div>
<h1>Your AI <span class="grass">gaffer.</span></h1>
<p>Build an autonomous AI manager. Deploy it onchain. It competes for you — every decision verifiable on 0G.</p>
<div class="foot">0G Chain · 0G Compute · 0G Storage · 0G DA &nbsp;—&nbsp; <b>autonomous AI football</b></div>
</body></html>`;

const b = await chromium.launch();
const ctx = await b.newContext({ deviceScaleFactor: 2 });

const p1 = await ctx.newPage();
await p1.setViewportSize({ width: 512, height: 512 });
await p1.setContent(logoHTML, { waitUntil: "networkidle" });
await p1.waitForTimeout(800);
await p1.screenshot({ path: "C:/Users/eobi6/zerocup/frontend/public/logo.png" });
console.log("logo.png");

const p2 = await ctx.newPage();
await p2.setViewportSize({ width: 1200, height: 630 });
await p2.setContent(coverHTML, { waitUntil: "networkidle" });
await p2.waitForTimeout(800);
await p2.screenshot({ path: "C:/Users/eobi6/zerocup/frontend/public/cover.png" });
console.log("cover.png");

await b.close();
