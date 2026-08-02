#!/usr/bin/env node
/**
 * Usage: npm run merge-candidates
 *
 * Scans candidates/*.json. Any entry with a non-empty editor_note is
 * "approved" — it gets appended to src/data/repos.json and removed from
 * the candidates file. Entries with no editor_note are left in place for
 * next time (nothing is ever silently dropped).
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPOS_PATH = path.join(__dirname, '../src/data/repos.json');
const CANDIDATES_DIR = path.join(__dirname, '../candidates');

const repos = JSON.parse(readFileSync(REPOS_PATH, 'utf-8'));
const existingIds = new Set(repos.map((r) => r.id.toLowerCase()));

let files;
try {
  files = readdirSync(CANDIDATES_DIR).filter((f) => f.endsWith('.json'));
} catch {
  console.log('No candidates/ directory found — run `npm run discover -- <category>` first.');
  process.exit(0);
}

let approvedCount = 0;
const today = new Date().toISOString().slice(0, 10);

for (const file of files) {
  const filePath = path.join(CANDIDATES_DIR, file);
  const candidates = JSON.parse(readFileSync(filePath, 'utf-8'));

  const approved = candidates.filter((c) => c.editor_note && c.editor_note.trim());
  const stillPending = candidates.filter((c) => !c.editor_note || !c.editor_note.trim());

  for (const c of approved) {
    if (existingIds.has(c.id.toLowerCase())) continue; // safety net, shouldn't happen
    repos.push({ ...c, added_at: today });
    existingIds.add(c.id.toLowerCase());
    approvedCount++;
    console.log(`  + ${c.id} → ${c.category}`);
  }

  writeFileSync(filePath, JSON.stringify(stillPending, null, 2) + '\n');
}

writeFileSync(REPOS_PATH, JSON.stringify(repos, null, 2) + '\n');
console.log(`\nMerged ${approvedCount} approved repo(s) into repos.json.`);
if (approvedCount === 0) {
  console.log('(Nothing had an editor_note filled in yet — edit the candidates/*.json files first.)');
}
