# RepoCatalog

Lightweight, categorized directory of useful GitHub repos. Static site, no backend, no database — see `repo-catalog-project-plan.md` for the full design doc.

## Run locally

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # outputs to dist/ — deploy this folder as-is
```

## Add a repo

Two ways: one-at-a-time when you know exactly what you want, or batch-discover to fill out a category fast.

**One at a time:**
```bash
export GITHUB_TOKEN=ghp_yourtoken   # optional but avoids rate limits, no scopes needed
npm run add-repo -- owner/repo category "one-sentence editor note"

# example:
npm run add-repo -- vercel/next.js devtools "The React framework most teams reach for first."
```

**Batch discovery (to get to 20-30 per category quickly):**
```bash
npm run discover -- devtools --min-stars=1000 --limit=30
```
This queries the GitHub Search API for that category's mapped topics (edit `TOPIC_MAP` in `scripts/discover.mjs` to tune relevance) and writes candidates you haven't already added to `candidates/devtools.json`, with `editor_note` left blank.

Open that file, skim the candidates, and fill in `editor_note` for the ones worth keeping — leave it blank to skip one (it'll just get re-suggested or ignored next run, nothing is silently added). Then:
```bash
npm run merge-candidates
```
This moves every candidate with a non-empty `editor_note` into `repos.json` and leaves the rest in `candidates/` for later. Nothing reaches the live site without a note — that's the curation gate, kept intentionally manual on purpose (see the project plan's §11 note on why this shouldn't be automated away).

Run `discover` once per category to seed your first 20-30, then fall back to `add-repo` for one-offs as you come across them.

## Health check

```bash
npm run health-check
```

Refreshes stars/last-commit for every repo and flags anything that's now 404 or newly archived. Runs automatically every night via `.github/workflows/health-check.yml` — no setup needed, it uses the repo's built-in `GITHUB_TOKEN`.

## Deploy

Push to GitHub, then import the repo on [Vercel](https://vercel.com/new) or [Netlify](https://app.netlify.com/start) — both auto-detect Astro, zero config needed. Or run `npm run build` and drop the `dist/` folder anywhere that serves static files.

## Structure

```
src/
  data/repos.json         ← the entire dataset, one source of truth
  data/categories.json    ← taxonomy (add a category here to add it site-wide)
  components/              RepoCard, CategoryTabs, SearchBar, RepoGrid, SiteFooter, icons.js
  pages/index.astro        homepage — all repos
  pages/category/[slug].astro   one page per category, statically generated
scripts/
  add-repo.mjs             curation CLI, one repo at a time
  discover.mjs             batch-finds candidates per category via GitHub Search API
  merge-candidates.mjs     promotes approved (noted) candidates into repos.json
  health-check.mjs         nightly data validator
.github/workflows/
  health-check.yml         runs health-check.mjs on a schedule, commits refreshed data
```
