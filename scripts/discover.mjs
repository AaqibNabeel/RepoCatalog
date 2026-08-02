#!/usr/bin/env node
/**
 * Usage: npm run discover -- <category> [--min-stars=500] [--limit=30]
 * Example: npm run discover -- devtools --min-stars=1000
 *
 * Queries the GitHub Search API for a category's mapped topics, filters
 * out repos already in repos.json (and forks/archived), and writes
 * candidates/<category>.json for you to review by hand.
 *
 * This does NOT touch repos.json. Nothing goes live until you fill in
 * editor_note on the candidates you want and run `npm run merge-candidates`.
 *
 * Set GITHUB_TOKEN to avoid the 60 req/hr unauthenticated rate limit.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPOS_PATH = path.join(__dirname, '../src/data/repos.json');
const CATEGORIES_PATH = path.join(__dirname, '../src/data/categories.json');
const CANDIDATES_DIR = path.join(__dirname, '../candidates');

// Map each category slug to the GitHub topics that best represent it.
// Tune these freely — this is the main lever for search relevance.
const TOPIC_MAP = {
  productivity: ['productivity', 'productivity-tools', 'note-taking'],
  design: ['design-tools', 'ui-design', 'prototyping'],
  ai: ['machine-learning', 'llm', 'artificial-intelligence'],
  devtools: ['developer-tools', 'cli', 'devtools'],
  learning: ['learning-resources', 'awesome-list', 'tutorial'],
  selfhosted: ['selfhosted', 'self-hosted', 'homelab'],
};

const args = process.argv.slice(2);
const category = args[0];
const minStars = Number((args.find((a) => a.startsWith('--min-stars=')) || '').split('=')[1] || 500);
const limit = Number((args.find((a) => a.startsWith('--limit=')) || '').split('=')[1] || 30);

const categories = JSON.parse(readFileSync(CATEGORIES_PATH, 'utf-8'));
const validSlugs = categories.map((c) => c.slug);

if (!category || !validSlugs.includes(category)) {
  console.error(`Usage: npm run discover -- <category> [--min-stars=N] [--limit=N]`);
  console.error(`category must be one of: ${validSlugs.join(', ')}`);
  process.exit(1);
}

const topics = TOPIC_MAP[category];
if (!topics) {
  console.error(`No topic mapping for "${category}" — add one to TOPIC_MAP in this script.`);
  process.exit(1);
}

const existingRepos = JSON.parse(readFileSync(REPOS_PATH, 'utf-8'));
const existingIds = new Set(existingRepos.map((r) => r.id.toLowerCase()));

if (!existsSync(CANDIDATES_DIR)) mkdirSync(CANDIDATES_DIR);
const candidatesPath = path.join(CANDIDATES_DIR, `${category}.json`);
const alreadyQueued = existsSync(candidatesPath)
  ? new Set(JSON.parse(readFileSync(candidatesPath, 'utf-8')).map((r) => r.id.toLowerCase()))
  : new Set();

const headers = { 'User-Agent': 'repocatalog-discover-script' };
if (process.env.GITHUB_TOKEN) {
  headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
}

const query = topics.map((t) => `topic:${t}`).join(' ') + ` stars:>=${minStars}`;
const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${Math.min(limit * 2, 100)}`;

const res = await fetch(url, { headers });
if (!res.ok) {
  console.error(`GitHub API error ${res.status}: ${await res.text()}`);
  process.exit(1);
}
const data = await res.json();

const candidates = [];
for (const gh of data.items) {
  const id = `${gh.owner.login}/${gh.name}`;
  if (existingIds.has(id.toLowerCase())) continue;
  if (alreadyQueued.has(id.toLowerCase())) continue;
  if (gh.fork || gh.archived) continue;

  candidates.push({
    id,
    owner: gh.owner.login,
    name: gh.name,
    url: gh.html_url,
    description: gh.description || '',
    category,
    tags: [],
    stars: gh.stargazers_count,
    language: gh.language,
    last_commit: gh.pushed_at.slice(0, 10),
    added_at: null, // filled in by merge-candidates.mjs on approval
    archived: false,
    editor_note: '', // <-- fill this in to approve the repo; leave blank to skip
  });
  if (candidates.length >= limit) break;
}

const merged = [
  ...(existsSync(candidatesPath) ? JSON.parse(readFileSync(candidatesPath, 'utf-8')) : []),
  ...candidates,
];
writeFileSync(candidatesPath, JSON.stringify(merged, null, 2) + '\n');

console.log(`Found ${candidates.length} new candidate(s) for "${category}".`);
console.log(`Written to candidates/${category}.json — fill in editor_note for the ones you want, then run:`);
console.log(`  npm run merge-candidates`);
