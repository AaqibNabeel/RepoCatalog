#!/usr/bin/env node
/**
 * Usage: npm run add-repo -- owner/repo category "editor note here"
 * Example: npm run add-repo -- vercel/next.js devtools "The React framework most teams reach for first."
 *
 * Fetches metadata from the GitHub API and appends a pre-filled entry to
 * src/data/repos.json. You still confirm category and write the editor
 * note by hand — that's the curation step, not something to automate away.
 *
 * Set GITHUB_TOKEN in your environment to avoid the 60 req/hr unauthenticated
 * rate limit (a classic PAT with no scopes is enough for public repo reads).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, '../src/data/repos.json');
const CATEGORIES_PATH = path.join(__dirname, '../src/data/categories.json');

const [ownerRepo, category, ...noteParts] = process.argv.slice(2);
const editorNote = noteParts.join(' ');

if (!ownerRepo || !ownerRepo.includes('/')) {
  console.error('Usage: npm run add-repo -- owner/repo category "editor note"');
  process.exit(1);
}

const categories = JSON.parse(readFileSync(CATEGORIES_PATH, 'utf-8'));
const validSlugs = categories.map((c) => c.slug);

if (!category || !validSlugs.includes(category)) {
  console.error(`category must be one of: ${validSlugs.join(', ')}`);
  process.exit(1);
}

if (!editorNote) {
  console.error('An editor note is required — that\'s the whole point of curation.');
  process.exit(1);
}

const [owner, repoName] = ownerRepo.split('/');
const headers = { 'User-Agent': 'repocatalog-curation-script' };
if (process.env.GITHUB_TOKEN) {
  headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
}

const res = await fetch(`https://api.github.com/repos/${owner}/${repoName}`, { headers });
if (!res.ok) {
  console.error(`GitHub API error ${res.status}: ${await res.text()}`);
  process.exit(1);
}
const gh = await res.json();

if (gh.archived) {
  console.warn('⚠️  Warning: this repo is archived. Adding it anyway, but double check it belongs.');
}

const repos = JSON.parse(readFileSync(DATA_PATH, 'utf-8'));

if (repos.some((r) => r.id.toLowerCase() === ownerRepo.toLowerCase())) {
  console.error(`${ownerRepo} is already in repos.json.`);
  process.exit(1);
}

const entry = {
  id: `${gh.owner.login}/${gh.name}`,
  owner: gh.owner.login,
  name: gh.name,
  url: gh.html_url,
  description: gh.description || '',
  category,
  tags: [],
  stars: gh.stargazers_count,
  language: gh.language,
  last_commit: gh.pushed_at.slice(0, 10),
  added_at: new Date().toISOString().slice(0, 10),
  archived: gh.archived,
  editor_note: editorNote,
};

repos.push(entry);
writeFileSync(DATA_PATH, JSON.stringify(repos, null, 2) + '\n');

console.log(`Added ${entry.id} → ${category}`);
console.log(`  ★ ${entry.stars}  ·  ${entry.language || 'no primary language'}  ·  last commit ${entry.last_commit}`);
