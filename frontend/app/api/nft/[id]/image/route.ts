import { publicClient } from "@/lib/server/contract";
import { CONTRACT_ADDRESS } from "@/lib/chain";
import { managerAiAbi } from "@/lib/abi";
import { archetypeFor, identityFor, TIER_RING } from "@/lib/agentIdentity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIERS = ["Rookie", "Pro", "Elite", "Legend"];
const ZERO = "0x0000000000000000000000000000000000000000";
const esc = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]!));

async function nameFor(origin: string, id: string): Promise<string> {
  for (const file of ["proofs.json", "veterans.json"]) {
    try {
      const d = await fetch(`${origin}/${file}`, { cache: "no-store" }).then((r) => r.json());
      const m = (d?.agents ?? []).find((x: { agentId: number }) => String(x.agentId) === String(id));
      if (m?.name) return m.name;
    } catch { /* next */ }
  }
  return `Gaffer #${id}`;
}

/** The agent's NFT art — a gaffer-bot card drawn as a self-contained SVG (shows on any marketplace). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let tier = 0;
  try {
    const a = (await publicClient.readContract({ address: CONTRACT_ADDRESS, abi: managerAiAbi, functionName: "getAgent", args: [BigInt(id)] })) as readonly unknown[];
    if ((a[0] as string) !== ZERO) tier = Number(a[8]);
  } catch { /* tier 0 */ }

  const origin = new URL(req.url).origin;
  const name = await nameFor(origin, id);
  const arc = archetypeFor(name);
  const { palette, bot } = identityFor(id, name);
  const ring = TIER_RING[tier] ?? TIER_RING[0];
  const A = palette.primary, INK = palette.ink;
  const cx = 300, hy = 150; // bot head centre-x, head top y (in 600 space)

  // simplified-but-faithful gaffer-bot, drawn directly
  const eyes = bot.eyes === 2
    ? `<rect x="${cx - 34}" y="240" width="68" height="22" rx="11" fill="${A}"/><rect x="${cx - 34}" y="240" width="68" height="10" rx="5" fill="#EAF6FF" opacity="0.5"/>`
    : `${[-34, 34].map((d) => `<circle cx="${cx + d}" cy="248" r="30" fill="${A}" opacity="0.35"/><circle cx="${cx + d}" cy="248" r="18" fill="${A}"/><circle cx="${cx + d}" cy="248" r="18" fill="#EAF6FF" opacity="0.5"/><circle cx="${cx + d - 5}" cy="242" r="5" fill="#fff"/>`).join("")}`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
  <defs>
    <radialGradient id="aura" cx="0.5" cy="0.4" r="0.6"><stop offset="0%" stop-color="${A}" stop-opacity="0.34"/><stop offset="65%" stop-color="${A}" stop-opacity="0.03"/><stop offset="100%" stop-color="${A}" stop-opacity="0"/></radialGradient>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0E1A2B"/><stop offset="1" stop-color="#0A1422"/></linearGradient>
    <linearGradient id="skin" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="0.55" stop-color="#E9EFF7"/><stop offset="1" stop-color="#C3CFE0"/></linearGradient>
    <linearGradient id="coat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#243650"/><stop offset="1" stop-color="#131E30"/></linearGradient>
    <linearGradient id="visor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#13243F"/><stop offset="1" stop-color="#060B16"/></linearGradient>
    <linearGradient id="cap" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${A}"/><stop offset="1" stop-color="${INK}"/></linearGradient>
  </defs>
  <rect width="600" height="600" fill="url(#bg)"/>
  <rect width="600" height="600" fill="url(#aura)"/>
  <rect x="14" y="14" width="572" height="572" rx="28" fill="none" stroke="${ring}" stroke-opacity="0.5" stroke-width="3"/>
  <text x="40" y="58" font-family="Arial,Helvetica,sans-serif" font-size="20" font-weight="800" letter-spacing="2" fill="#00C853">GAFFER</text>
  <text x="560" y="58" text-anchor="end" font-family="Arial,Helvetica,sans-serif" font-size="18" font-weight="800" fill="${ring}">${TIERS[tier]} · #${id}</text>

  <!-- coat -->
  <path d="M150 470 L156 410 Q162 384 210 378 L390 378 Q438 384 444 410 L450 470 Z" fill="url(#coat)"/>
  <!-- scarf -->
  <path d="M${cx - 52} 372 Q${cx} 396 ${cx + 52} 372 L${cx + 48} 392 Q${cx} 414 ${cx - 48} 392 Z" fill="${A}"/>
  <rect x="${cx - 22}" y="392" width="20" height="56" rx="5" fill="${A}"/><rect x="${cx + 2}" y="392" width="20" height="56" rx="5" fill="${A}"/>
  <rect x="${cx - 22}" y="404" width="20" height="7" fill="#fff" opacity="0.8"/><rect x="${cx + 2}" y="404" width="20" height="7" fill="#fff" opacity="0.8"/>
  <!-- head -->
  <rect x="${cx - 92}" y="${hy}" width="184" height="184" rx="84" fill="url(#skin)" stroke="#AEBCCE" stroke-width="2.5"/>
  <ellipse cx="${cx - 24}" cy="${hy + 50}" rx="56" ry="32" fill="#fff" opacity="0.5"/>
  <!-- visor -->
  <rect x="${cx - 66}" y="208" width="132" height="92" rx="42" fill="url(#visor)"/>
  ${eyes}
  <path d="M${cx - 18} 286 Q${cx} 298 ${cx + 18} 286" fill="none" stroke="${A}" stroke-width="4.5" stroke-linecap="round" opacity="0.85"/>
  <!-- cap -->
  <path d="M${cx - 74} ${hy + 18} C${cx - 68} ${hy - 36} ${cx + 12} ${hy - 48} ${cx + 50} ${hy - 24} C${cx + 68} ${hy - 12} ${cx + 70} ${hy + 6} ${cx + 68} ${hy + 18} Z" fill="url(#cap)"/>
  <path d="M${cx - 68} ${hy + 18} C${cx - 108} ${hy + 15} ${cx - 126} ${hy + 27} ${cx - 132} ${hy + 36} C${cx - 129} ${hy + 42} ${cx - 102} ${hy + 33} ${cx - 68} ${hy + 27} Z" fill="${INK}" opacity="0.9"/>

  <text x="300" y="512" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="40" font-weight="800" fill="#F5F7FA">${esc(name)}</text>
  <text x="300" y="542" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="20" font-weight="700" fill="${ring}">${esc(arc.tag)}</text>
  <text x="300" y="566" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="15" fill="#7B8FBF">${esc(arc.line)}</text>
</svg>`;

  return new Response(svg, { headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=60" } });
}
