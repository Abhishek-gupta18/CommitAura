import type { VercelRequest, VercelResponse } from "@vercel/node";
import { resolveToken, computeStats } from "../../_lib/github.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { username } = req.query;

  if (!username || typeof username !== "string" || !username.trim()) {
    return res.status(400).json({ error: "Invalid username" });
  }

  const token = resolveToken(req.query.token as string | undefined);

  try {
    const stats = await computeStats(username.trim(), token);
    if (!stats) {
      return res.status(404).json({ error: `User '${username}' not found on GitHub` });
    }
    return res.status(200).json(stats);
  } catch {
    return res.status(500).json({ error: "Failed to fetch GitHub stats" });
  }
}
