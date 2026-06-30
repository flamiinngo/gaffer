import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Nudges the matchday action to run NOW (GitHub repository_dispatch), so a just-deployed gaffer
 * picks its XI on 0G Compute within ~2 minutes instead of waiting for the 6-hour cron. Degrades
 * gracefully: if no token is configured it's a no-op and the scheduled run still covers it.
 */
const REPO = process.env.GH_REPO || "flamiinngo/gaffer";

export async function POST() {
  const token = process.env.GH_DISPATCH_TOKEN;
  if (!token) return NextResponse.json({ ok: false, reason: "no GH_DISPATCH_TOKEN — will run on the next scheduled cycle" });
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ event_type: "pick-now" }),
    });
    return NextResponse.json({ ok: res.status === 204, status: res.status });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message });
  }
}
