import { Router } from "express";
import {
  GetGithubStatsParams,
  GetGithubStatsQueryParams,
  GetGithubContributionsParams,
  GetGithubContributionsQueryParams,
  GetGithubProfileParams,
  GetGithubProfileQueryParams,
} from "@workspace/api-zod";

const router = Router();

const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";
const GITHUB_REST_URL = "https://api.github.com";

function getServerToken(): string | undefined {
  return process.env.GITHUB_TOKEN || undefined;
}

function resolveToken(queryToken?: string | null): string | undefined {
  return queryToken || getServerToken();
}

function getHeaders(token?: string | null) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/vnd.github.v3+json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

interface ContributionDayRaw {
  date: string;
  contributionCount: number;
  contributionLevel: string;
}

interface ContributionWeekRaw {
  contributionDays: ContributionDayRaw[];
}

interface ContributionCalendarRaw {
  totalContributions: number;
  weeks: ContributionWeekRaw[];
}

interface ContributionCalendarResponse {
  data: {
    user: {
      contributionsCollection: {
        contributionCalendar: ContributionCalendarRaw;
      };
    } | null;
  };
  errors?: Array<{ message: string }>;
}

function levelFromString(level: string): number {
  switch (level) {
    case "NONE":
      return 0;
    case "FIRST_QUARTILE":
      return 1;
    case "SECOND_QUARTILE":
      return 2;
    case "THIRD_QUARTILE":
      return 3;
    case "FOURTH_QUARTILE":
      return 4;
    default:
      return 0;
  }
}

async function fetchContributionCalendar(
  username: string,
  from: string,
  to: string,
  token?: string | null
): Promise<ContributionCalendarRaw | null> {
  const query = `
    query($username: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $username) {
        contributionsCollection(from: $from, to: $to) {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                date
                contributionCount
                contributionLevel
              }
            }
          }
        }
      }
    }
  `;

  const response = await fetch(GITHUB_GRAPHQL_URL, {
    method: "POST",
    headers: getHeaders(token),
    body: JSON.stringify({
      query,
      variables: { username, from, to },
    }),
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as ContributionCalendarResponse;

  if (data.errors || !data.data?.user) {
    return null;
  }

  return data.data.user.contributionsCollection.contributionCalendar;
}

interface GithubUserRest {
  login: string;
  name: string | null;
  bio: string | null;
  avatar_url: string;
  followers: number;
  following: number;
  public_repos: number;
  public_gists: number;
  created_at: string;
  location: string | null;
  blog: string | null;
  company: string | null;
  twitter_username: string | null;
  message?: string;
}

async function fetchUserProfile(
  username: string,
  token?: string | null
): Promise<GithubUserRest | null> {
  const tryFetch = async (withToken: boolean) => {
    return fetch(`${GITHUB_REST_URL}/users/${username}`, {
      headers: getHeaders(withToken ? token : null),
    });
  };

  let response = await tryFetch(!!token);

  // If token is bad, retry without token for public profiles
  if (response.status === 401 && token) {
    response = await tryFetch(false);
  }

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error(`GitHub API error: ${response.status}`);
  }

  return (await response.json()) as GithubUserRest;
}

function computeStreaks(allDays: Array<{ date: string; count: number }>): {
  currentStreak: number;
  longestStreak: number;
  currentStreakStart: string | null;
  currentStreakEnd: string | null;
  longestStreakStart: string | null;
  longestStreakEnd: string | null;
} {
  if (allDays.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      currentStreakStart: null,
      currentStreakEnd: null,
      longestStreakStart: null,
      longestStreakEnd: null,
    };
  }

  const sorted = [...allDays].sort((a, b) => a.date.localeCompare(b.date));
  const todayStr = new Date().toISOString().split("T")[0];

  let longestStreak = 0;
  let longestStreakStart: string | null = null;
  let longestStreakEnd: string | null = null;
  let streak = 0;
  let streakStart: string | null = null;

  for (let i = 0; i < sorted.length; i++) {
    const day = sorted[i];
    if (day.count > 0) {
      if (streak === 0) streakStart = day.date;
      streak++;
      if (streak > longestStreak) {
        longestStreak = streak;
        longestStreakStart = streakStart;
        longestStreakEnd = day.date;
      }
    } else {
      streak = 0;
      streakStart = null;
    }
  }

  let currentStreak = 0;
  let currentStreakStart: string | null = null;
  let currentStreakEnd: string | null = null;

  const todayIdx = sorted.findIndex((d) => d.date === todayStr);
  let startIdx = todayIdx >= 0 ? todayIdx : sorted.length - 1;

  if (todayIdx >= 0 && sorted[todayIdx].count === 0) {
    if (todayIdx > 0 && sorted[todayIdx - 1].count > 0) {
      startIdx = todayIdx - 1;
    } else {
      return {
        currentStreak: 0,
        longestStreak,
        currentStreakStart: null,
        currentStreakEnd: null,
        longestStreakStart,
        longestStreakEnd,
      };
    }
  }

  for (let i = startIdx; i >= 0; i--) {
    const day = sorted[i];
    if (day.count > 0) {
      currentStreak++;
      currentStreakStart = day.date;
      if (currentStreakEnd === null) currentStreakEnd = day.date;
    } else {
      break;
    }
  }

  return {
    currentStreak,
    longestStreak,
    currentStreakStart,
    currentStreakEnd,
    longestStreakStart,
    longestStreakEnd,
  };
}

interface GithubStats {
  username: string;
  totalContributions: number;
  currentStreak: number;
  longestStreak: number;
  currentStreakStart: string | null;
  currentStreakEnd: string | null;
  longestStreakStart: string | null;
  longestStreakEnd: string | null;
  contributionsThisYear: number;
  accountCreatedAt: string;
  firstContributionDate: string | null;
}

async function validateToken(token: string): Promise<boolean> {
  const res = await fetch(`${GITHUB_REST_URL}/user`, {
    headers: getHeaders(token),
  });
  return res.ok;
}

async function computeStats(
  username: string,
  token?: string | null
): Promise<GithubStats | null> {
  // If token fails basic auth check, clear it so REST falls back to public
  let effectiveToken = token;
  if (effectiveToken) {
    const valid = await validateToken(effectiveToken);
    if (!valid) {
      effectiveToken = null;
    }
  }

  const profile = await fetchUserProfile(username, effectiveToken);
  if (!profile) return null;

  const accountCreatedAt = new Date(profile.created_at);
  const now = new Date();
  const startYear = accountCreatedAt.getFullYear();
  const currentYear = now.getFullYear();

  const allDays: Array<{ date: string; count: number }> = [];
  let totalContributions = 0;
  let contributionsThisYear = 0;

  for (let year = startYear; year <= currentYear; year++) {
    const from = new Date(year, 0, 1).toISOString();
    const to =
      year === currentYear
        ? now.toISOString()
        : new Date(year, 11, 31, 23, 59, 59).toISOString();

    let calendar: ContributionCalendarRaw | null = null;
    try {
      calendar = await fetchContributionCalendar(username, from, to, effectiveToken);
    } catch {
      // ignore per-year errors
    }

    if (calendar) {
      totalContributions += calendar.totalContributions;
      if (year === currentYear) contributionsThisYear = calendar.totalContributions;

      for (const week of calendar.weeks) {
        for (const day of week.contributionDays) {
          allDays.push({ date: day.date, count: day.contributionCount });
        }
      }
    }
  }

  const streaks = computeStreaks(allDays);
  const firstContrib = allDays.find((d) => d.count > 0);

  return {
    username,
    totalContributions,
    currentStreak: streaks.currentStreak,
    longestStreak: streaks.longestStreak,
    currentStreakStart: streaks.currentStreakStart,
    currentStreakEnd: streaks.currentStreakEnd,
    longestStreakStart: streaks.longestStreakStart,
    longestStreakEnd: streaks.longestStreakEnd,
    contributionsThisYear,
    accountCreatedAt: accountCreatedAt.toISOString().split("T")[0],
    firstContributionDate: firstContrib ? firstContrib.date : null,
  };
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function generateSvgCard(stats: GithubStats): string {
  const hasStats = stats.totalContributions > 0 || stats.currentStreak > 0 || stats.longestStreak > 0;
  const W = 520;
  const H = hasStats ? 195 : 215;
  const colW = W / 3;

  const totalLabel = "Total Contributions";
  const streakLabel = "Current Streak";
  const longestLabel = "Longest Streak";

  const totalVal = stats.totalContributions.toLocaleString();
  const streakVal = stats.currentStreak.toString();
  const longestVal = stats.longestStreak.toString();

  const totalSub = stats.firstContributionDate
    ? `${formatDate(stats.firstContributionDate)} – Present`
    : "No contributions yet";

  const streakSub = stats.currentStreak > 0
    ? stats.currentStreakStart === stats.currentStreakEnd
      ? formatDate(stats.currentStreakStart)
      : `${formatDate(stats.currentStreakStart)} – ${formatDate(stats.currentStreakEnd)}`
    : formatDate(new Date().toISOString().split("T")[0]);

  const longestSub = stats.longestStreak > 0
    ? `${formatDate(stats.longestStreakStart)} – ${formatDate(stats.longestStreakEnd)}`
    : "No streak yet";

  const col1X = colW * 0 + colW / 2;
  const col2X = colW * 1 + colW / 2;
  const col3X = colW * 2 + colW / 2;

  const dividerColor = "#21262d";
  const bgColor = "#0d1117";
  const borderColor = "#30363d";
  const textMuted = "#8b949e";
  const textBright = "#e6edf3";

  const color1 = "#3fb950";
  const color2 = "#f78166";
  const color3 = "#79c0ff";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none" role="img" aria-label="GitHub Stats for ${escapeXml(stats.username)}">
  <title>GitHub Stats: ${escapeXml(stats.username)}</title>
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&amp;display=swap');
      text { font-family: 'Segoe UI', 'Inter', system-ui, -apple-system, sans-serif; }
    </style>
    <clipPath id="card-clip">
      <rect width="${W}" height="${H}" rx="12" ry="12"/>
    </clipPath>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" rx="12" ry="12" fill="${bgColor}" stroke="${borderColor}" stroke-width="1"/>
  <g clip-path="url(#card-clip)">

    <!-- Top label bar -->
    <rect x="0" y="0" width="${W}" height="42" fill="#161b22"/>
    <line x1="0" y1="42" x2="${W}" y2="42" stroke="${dividerColor}" stroke-width="1"/>

    <!-- Header: GitHub logo + username -->
    <svg x="16" y="10" width="22" height="22" viewBox="0 0 16 16" fill="${color1}">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
    </svg>
    <text x="44" y="26" font-size="13" font-weight="600" fill="${textBright}" letter-spacing="0.3">
      ${escapeXml(stats.username)}'s GitHub Stats
    </text>

    <!-- Dividers between columns -->
    <line x1="${colW}" y1="42" x2="${colW}" y2="${H}" stroke="${dividerColor}" stroke-width="1"/>
    <line x1="${colW * 2}" y1="42" x2="${colW * 2}" y2="${H}" stroke="${dividerColor}" stroke-width="1"/>

    <!-- ── Column 1: Total Contributions ── -->
    <!-- Star icon -->
    <svg x="${col1X - 8}" y="52" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${color1}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
    <!-- Big number -->
    <text x="${col1X}" y="102" font-size="32" font-weight="700" fill="${color1}" text-anchor="middle">${escapeXml(totalVal)}</text>
    <!-- Label -->
    <text x="${col1X}" y="122" font-size="11" font-weight="600" fill="${textBright}" text-anchor="middle">${escapeXml(totalLabel)}</text>
    <!-- Sub date -->
    <text x="${col1X}" y="140" font-size="9.5" fill="${textMuted}" text-anchor="middle">${escapeXml(totalSub)}</text>

    <!-- ── Column 2: Current Streak ── -->
    <!-- Flame icon -->
    <svg x="${col2X - 8}" y="52" width="16" height="16" viewBox="0 0 24 24" fill="${color2}" stroke="${color2}" stroke-width="0">
      <path d="M12 2c0 0-4 4-4 8a4 4 0 0 0 8 0c0-1.5-.5-3-1.5-4C14 7.5 14 9 13 10c0 0-1-1.5-1-3.5 0-1.5.5-3.5.5-3.5L12 2z"/>
      <path d="M12 22c-3.31 0-6-2.69-6-6 0-3 1.5-5 3-6.5.5 2 2 3.5 2 3.5C11.5 11.5 12 9 12 9c1 1.5 1.5 3 1.5 4.5 0 .83-.34 1.58-.88 2.12A2 2 0 0 0 14 14c0 1.1-.9 2-2 2s-2-.9-2-2c0-.55.22-1.05.59-1.41C9.22 13.59 9 14.28 9 15c0 1.66 1.34 3 3 3s3-1.34 3-3c0-.74-.27-1.41-.71-1.93A3.978 3.978 0 0 1 15.5 16c0 1.93-1.57 3.5-3.5 3.5z"/>
    </svg>
    <!-- Big number -->
    <text x="${col2X}" y="102" font-size="32" font-weight="700" fill="${color2}" text-anchor="middle">${escapeXml(streakVal)}</text>
    <!-- "day" / "days" unit -->
    <text x="${col2X}" y="118" font-size="10" fill="${color2}" text-anchor="middle" opacity="0.8">${stats.currentStreak === 1 ? "day" : "days"}</text>
    <!-- Label -->
    <text x="${col2X}" y="133" font-size="11" font-weight="600" fill="${color2}" text-anchor="middle">${escapeXml(streakLabel)}</text>
    <!-- Sub date -->
    <text x="${col2X}" y="151" font-size="9.5" fill="${textMuted}" text-anchor="middle">${escapeXml(streakSub)}</text>

    <!-- ── Column 3: Longest Streak ── -->
    <!-- Trophy icon -->
    <svg x="${col3X - 8}" y="52" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${color3}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="8 22 12 17 16 22"/>
      <line x1="12" y1="17" x2="12" y2="11"/>
      <path d="M7 4H17l-1 7a5 5 0 0 1-8 0L7 4Z"/>
      <path d="M3 4h4M17 4h4"/>
    </svg>
    <!-- Big number -->
    <text x="${col3X}" y="102" font-size="32" font-weight="700" fill="${color3}" text-anchor="middle">${escapeXml(longestVal)}</text>
    <!-- "day" / "days" unit -->
    <text x="${col3X}" y="118" font-size="10" fill="${color3}" text-anchor="middle" opacity="0.8">${stats.longestStreak === 1 ? "day" : "days"}</text>
    <!-- Label -->
    <text x="${col3X}" y="133" font-size="11" font-weight="600" fill="${textBright}" text-anchor="middle">${escapeXml(longestLabel)}</text>
    <!-- Sub date -->
    <text x="${col3X}" y="151" font-size="9.5" fill="${textMuted}" text-anchor="middle">${escapeXml(longestSub)}</text>

    ${!hasStats ? `
    <!-- Token required note -->
    <line x1="16" y1="${H - 35}" x2="${W - 16}" y2="${H - 35}" stroke="${dividerColor}" stroke-width="1"/>
    <svg x="16" y="${H - 27}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e3b341" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
    <text x="34" y="${H - 17}" font-size="10" fill="#e3b341" font-family="'Segoe UI', system-ui, sans-serif">Set a valid GITHUB_TOKEN on your server to show contribution stats</text>
    ` : ""}
  </g>
</svg>`;
}

function generateSvgError(message: string): string {
  const W = 520;
  const H = 120;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" rx="12" ry="12" fill="#0d1117" stroke="#30363d" stroke-width="1"/>
  <text x="${W / 2}" y="52" font-size="13" font-weight="600" fill="#f78166" text-anchor="middle" font-family="'Segoe UI', system-ui, sans-serif">Error</text>
  <text x="${W / 2}" y="74" font-size="11" fill="#8b949e" text-anchor="middle" font-family="'Segoe UI', system-ui, sans-serif">${escapeXml(message)}</text>
</svg>`;
}

// ─── SVG Card endpoint ────────────────────────────────────────────────────────
// Usage: GET /api/github/card?user=username
// Returns an SVG image that can be embedded in a GitHub README:
//   ![GitHub Stats](https://your-app.com/api/github/card?user=username)
router.get("/github/card", async (req, res) => {
  const user = req.query.user as string | undefined;

  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");

  if (!user || typeof user !== "string" || !user.trim()) {
    res.status(400).send(generateSvgError("Missing ?user= parameter"));
    return;
  }

  const token = resolveToken(req.query.token as string | undefined);

  try {
    const stats = await computeStats(user.trim(), token);

    if (!stats) {
      res
        .status(404)
        .send(generateSvgError(`User '${user}' not found on GitHub`));
      return;
    }

    res.status(200).send(generateSvgCard(stats));
  } catch (err) {
    req.log.error({ err }, "Failed to generate GitHub card");
    res
      .status(500)
      .send(generateSvgError("Failed to fetch stats. Please try again later."));
  }
});

// ─── JSON routes ──────────────────────────────────────────────────────────────

router.get("/github/stats/:username", async (req, res) => {
  const paramsResult = GetGithubStatsParams.safeParse(req.params);
  if (!paramsResult.success) {
    res.status(400).json({ error: "Invalid username" });
    return;
  }

  const queryResult = GetGithubStatsQueryParams.safeParse(req.query);
  const token = resolveToken(
    queryResult.success ? queryResult.data.token : undefined
  );
  const { username } = paramsResult.data;

  try {
    const stats = await computeStats(username, token);

    if (!stats) {
      res.status(404).json({ error: `User '${username}' not found on GitHub` });
      return;
    }

    res.json(stats);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch GitHub stats");
    res.status(500).json({ error: "Failed to fetch GitHub stats" });
  }
});

router.get("/github/contributions/:username", async (req, res) => {
  const paramsResult = GetGithubContributionsParams.safeParse(req.params);
  if (!paramsResult.success) {
    res.status(400).json({ error: "Invalid username" });
    return;
  }

  const queryResult = GetGithubContributionsQueryParams.safeParse(req.query);
  const token = resolveToken(
    queryResult.success ? queryResult.data.token : undefined
  );
  const year =
    queryResult.success && queryResult.data.year
      ? Number(queryResult.data.year)
      : new Date().getFullYear();

  const { username } = paramsResult.data;

  try {
    const from = new Date(year, 0, 1).toISOString();
    const to =
      year === new Date().getFullYear()
        ? new Date().toISOString()
        : new Date(year, 11, 31, 23, 59, 59).toISOString();

    const calendar = await fetchContributionCalendar(username, from, to, token);

    if (!calendar) {
      res.status(404).json({
        error: `Could not fetch contributions for '${username}'.`,
      });
      return;
    }

    const weeks = calendar.weeks.map((week) => ({
      days: week.contributionDays.map((day) => ({
        date: day.date,
        count: day.contributionCount,
        level: levelFromString(day.contributionLevel),
      })),
    }));

    res.json({ totalContributions: calendar.totalContributions, weeks, year });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch GitHub contributions");
    res.status(500).json({ error: "Failed to fetch GitHub contributions" });
  }
});

router.get("/github/profile/:username", async (req, res) => {
  const paramsResult = GetGithubProfileParams.safeParse(req.params);
  if (!paramsResult.success) {
    res.status(400).json({ error: "Invalid username" });
    return;
  }

  const queryResult = GetGithubProfileQueryParams.safeParse(req.query);
  const token = resolveToken(
    queryResult.success ? queryResult.data.token : undefined
  );
  const { username } = paramsResult.data;

  try {
    const profile = await fetchUserProfile(username, token);
    if (!profile) {
      res.status(404).json({ error: `User '${username}' not found on GitHub` });
      return;
    }

    res.json({
      username: profile.login,
      name: profile.name,
      bio: profile.bio,
      avatarUrl: profile.avatar_url,
      followers: profile.followers,
      following: profile.following,
      publicRepos: profile.public_repos,
      publicGists: profile.public_gists,
      createdAt: profile.created_at,
      location: profile.location,
      blog: profile.blog,
      company: profile.company,
      twitterUsername: profile.twitter_username,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch GitHub profile");
    res.status(500).json({ error: "Failed to fetch GitHub profile" });
  }
});

export default router;
