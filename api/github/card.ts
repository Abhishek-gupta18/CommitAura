import type { VercelRequest, VercelResponse } from "@vercel/node";
import { resolveToken, computeStats, generateSvgCard, generateSvgError } from "../_lib/github.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const user = req.query.user as string | undefined;

  if (!user || typeof user !== "string" || !user.trim()) {
    return res.status(400).send(generateSvgError("Missing ?user= parameter"));
  }

  const token = resolveToken(req.query.token as string | undefined);

  try {
    const stats = await computeStats(user.trim(), token);
    if (!stats) {
      return res.status(404).send(generateSvgError(`User '${user}' not found on GitHub`));
    }
    return res.status(200).send(generateSvgCard(stats));
  } catch {
    return res.status(500).send(generateSvgError("Failed to fetch stats. Please try again later."));
  }
}
