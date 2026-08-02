import { defineConfig } from 'astro/config';

// Static site, no framework integration needed — Fuse.js runs as a
// plain <script> in the browser. Keep it lightweight on purpose.
export default defineConfig({
  output: 'static',
  site: 'https://example.com', // TODO: replace with your real domain before deploy
});
