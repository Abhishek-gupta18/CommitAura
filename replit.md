# Workspace

## Overview

pnpm workspace monorepo using TypeScript. GitHub Stats Tracker web app that accurately counts all GitHub contributions, streaks, and displays a beautiful heatmap.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (artifacts/github-stats)
- **API framework**: Express 5 (artifacts/api-server)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Styling**: Tailwind CSS, dark theme

## Key Features

- Accurate total contribution count (fetches from ALL years since account creation via GitHub GraphQL API)
- Accurate current and longest streak calculation
- Visual contribution heatmap calendar
- GitHub profile card (avatar, bio, followers, repos, etc.)
- GitHub Personal Access Token support (required for GitHub GraphQL API - stored in localStorage)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## GitHub API Token Requirement

GitHub's GraphQL API (required for contribution data) requires authentication. Users need to provide a Personal Access Token:
- Settings → Developer settings → Personal access tokens → Fine-grained tokens
- Required scope: `read:user` (or classic token with no extra scopes)

## Architecture

- `artifacts/github-stats` — React + Vite frontend (served at `/`)
- `artifacts/api-server` — Express backend (served at `/api`)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth)
- `lib/api-client-react` — Generated React Query hooks
- `lib/api-zod` — Generated Zod validation schemas

## api-zod fix note

After running codegen, `lib/api-zod/src/generated/types/index.ts` needs to exclude the Params types (`getGithubStatsParams`, `getGithubContributionsParams`, `getGithubProfileParams`) since they are already exported from `generated/api.ts` to avoid TS2308 duplicate export errors.

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
