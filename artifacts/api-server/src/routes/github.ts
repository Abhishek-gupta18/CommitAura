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
  const response = await fetch(`${GITHUB_REST_URL}/users/${username}`, {
    headers: getHeaders(token),
  });

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

  // Sort ascending by date
  const sorted = [...allDays].sort((a, b) => a.date.localeCompare(b.date));

  const todayStr = new Date().toISOString().split("T")[0];

  // Compute longest streak
  let longestStreak = 0;
  let longestStreakStart: string | null = null;
  let longestStreakEnd: string | null = null;
  let streak = 0;
  let streakStart: string | null = null;

  for (let i = 0; i < sorted.length; i++) {
    const day = sorted[i];
    if (day.count > 0) {
      if (streak === 0) {
        streakStart = day.date;
      }
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

  // Compute current streak (working backwards from today or yesterday)
  let currentStreak = 0;
  let currentStreakStart: string | null = null;
  let currentStreakEnd: string | null = null;

  // Find today's index
  const todayIdx = sorted.findIndex((d) => d.date === todayStr);

  // Start from today if it exists, otherwise from last available day
  let startIdx = todayIdx >= 0 ? todayIdx : sorted.length - 1;

  // If today has 0 contributions, we allow checking from yesterday
  // (streak might still be active if today hasn't ended yet, but we 
  // also check if yesterday had contributions)
  if (todayIdx >= 0 && sorted[todayIdx].count === 0) {
    // Today has 0 - check if yesterday had contributions
    // If yes, we start current streak check from yesterday
    if (todayIdx > 0 && sorted[todayIdx - 1].count > 0) {
      startIdx = todayIdx - 1;
    } else {
      // No current streak
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

  // Walk backwards from startIdx to count current streak
  for (let i = startIdx; i >= 0; i--) {
    const day = sorted[i];
    if (day.count > 0) {
      currentStreak++;
      currentStreakStart = day.date;
      if (currentStreakEnd === null) {
        currentStreakEnd = day.date;
      }
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

router.get("/github/stats/:username", async (req, res) => {
  const paramsResult = GetGithubStatsParams.safeParse(req.params);
  if (!paramsResult.success) {
    res.status(400).json({ error: "Invalid username" });
    return;
  }

  const queryResult = GetGithubStatsQueryParams.safeParse(req.query);
  const token = queryResult.success ? queryResult.data.token : undefined;
  const { username } = paramsResult.data;

  try {
    const profile = await fetchUserProfile(username, token);
    if (!profile) {
      res.status(404).json({ error: `User '${username}' not found on GitHub` });
      return;
    }

    const accountCreatedAt = new Date(profile.created_at);
    const now = new Date();

    // Fetch contributions for ALL years from account creation to now
    const startYear = accountCreatedAt.getFullYear();
    const currentYear = now.getFullYear();

    const allDays: Array<{ date: string; count: number }> = [];
    let totalContributions = 0;
    let contributionsThisYear = 0;

    // Fetch each year in sequence to avoid rate limiting
    for (let year = startYear; year <= currentYear; year++) {
      const from = new Date(year, 0, 1).toISOString();
      const to =
        year === currentYear
          ? now.toISOString()
          : new Date(year, 11, 31, 23, 59, 59).toISOString();

      let calendar: ContributionCalendarRaw | null = null;
      try {
        calendar = await fetchContributionCalendar(username, from, to, token);
      } catch {
        // ignore per-year errors and continue
      }

      if (calendar) {
        totalContributions += calendar.totalContributions;
        if (year === currentYear) {
          contributionsThisYear = calendar.totalContributions;
        }

        for (const week of calendar.weeks) {
          for (const day of week.contributionDays) {
            allDays.push({ date: day.date, count: day.contributionCount });
          }
        }
      }
    }

    const streaks = computeStreaks(allDays);

    // Find first contribution date
    const firstContrib = allDays.find((d) => d.count > 0);

    // If we have no data at all and no token, return a helpful message
    if (allDays.length === 0 && !token) {
      res.status(403).json({
        error:
          "GitHub's contribution data requires a Personal Access Token. Please add your GitHub PAT (Settings → Developer settings → Personal access tokens → Fine-grained tokens) with 'read:user' scope.",
      });
      return;
    }

    res.json({
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
    });
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
  const token = queryResult.success ? queryResult.data.token : undefined;
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
        error: token
          ? `Could not fetch contributions for '${username}'. The user may not exist or the token may be invalid.`
          : `GitHub's contribution data requires authentication. Please provide a GitHub Personal Access Token (Settings → Developer settings → Personal access tokens) with 'read:user' scope.`,
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

    res.json({
      totalContributions: calendar.totalContributions,
      weeks,
      year,
    });
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
  const token = queryResult.success ? queryResult.data.token : undefined;
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
