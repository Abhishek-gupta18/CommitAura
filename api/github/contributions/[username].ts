import type { VercelRequest, VercelResponse } from "@vercel/node";
import { resolveToken, fetchContributionCalendar, levelFromString } from "../../_lib/github.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { username } = req.query;

  if (!username || typeof username !== "string" || !username.trim()) {
    return res.status(400).json({ error: "Invalid username" });
  }

  const token = resolveToken(req.query.token as string | undefined);
  const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();

  try {
    const from = new Date(year, 0, 1).toISOString();
    const to = year === new Date().getFullYear()
      ? new Date().toISOString()
      : new Date(year, 11, 31, 23, 59, 59).toISOString();

    const calendar = await fetchContributionCalendar(username.trim(), from, to, token);

    if (!calendar) {
      return res.status(404).json({ error: `Could not fetch contributions for '${username}'.` });
    }

    const weeks = calendar.weeks.map((week) => ({
      days: week.contributionDays.map((day) => ({
        date: day.date,
        count: day.contributionCount,
        level: levelFromString(day.contributionLevel),
      })),
    }));

    return res.status(200).json({ totalContributions: calendar.totalContributions, weeks, year });
  } catch {
    return res.status(500).json({ error: "Failed to fetch GitHub contributions" });
  }
}
