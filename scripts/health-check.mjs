#!/usr/bin/env node
/**
 * Refreshes stars/last-commit for every repo in repos.json and flags
 * anything that's now 404 or archived. Run nightly via GitHub Actions
 * (see .github/workflows/health-check.yml).
 *
 * Exit code 0 = all clean, data updated.
 * Exit code 1 = at least one repo needs human attention (dead link or
 * newly archived) — the workflow surfaces this as a failed run.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, '../src/data/repos.json');

const headers = { 'User-Agent': 'repocatalog-health-check' };
if (process.env.GITHUB_TOKEN) {
  headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
}

const repos = JSON.parse(readFileSync(DATA_PATH, 'utf-8'));
const problems = [];

for (const repo of repos) {
  const res = await fetch(`https://api.github.com/repos/${repo.id}`, { headers });

  if (res.status === 404) {
    problems.push(`404  ${repo.id} — repo renamed, deleted, or made private`);
    continue;
  }
  if (!res.ok) {
    problems.push(`ERR  ${repo.id} — GitHub API returned ${res.status}`);
    continue;
  }

  const gh = await res.json();

  if (gh.archived && !repo.archived) {
    problems.push(`ARCH ${repo.id} — newly archived, review whether it still belongs`);
  }

  repo.stars = gh.stargazers_count;
  repo.language = gh.language;
  repo.last_commit = gh.pushed_at.slice(0, 10);
  repo.archived = gh.archived;
}

writeFileSync(DATA_PATH, JSON.stringify(repos, null, 2) + '\n');

if (problems.length) {
  console.log(`Health check found ${problems.length} issue(s):\n`);
  problems.forEach((p) => console.log('  ' + p));
  process.exit(1);
} else {
  console.log(`Health check clean — refreshed ${repos.length} repos.`);
}
