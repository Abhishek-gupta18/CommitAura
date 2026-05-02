import type { VercelRequest, VercelResponse } from "@vercel/node";
import { resolveToken, fetchUserProfile } from "../../_lib/github.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { username } = req.query;

  if (!username || typeof username !== "string" || !username.trim()) {
    return res.status(400).json({ error: "Invalid username" });
  }

  const token = resolveToken(req.query.token as string | undefined);

  try {
    const profile = await fetchUserProfile(username.trim(), token);
    if (!profile) {
      return res.status(404).json({ error: `User '${username}' not found on GitHub` });
    }

    return res.status(200).json({
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
  } catch {
    return res.status(500).json({ error: "Failed to fetch GitHub profile" });
  }
}
