import { readdirSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { configDefaults } from 'vitest/config';
import { defineConfig, type Plugin } from 'vite';

/** Files the service worker should not fetch ahead of time. */
const SKIP_PRECACHE = new Set(['sw.js', 'precache-manifest.json', 'share.png']);

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

/**
 * After a build, write the list of every output file so the service worker
 * (public/sw.js) can cache the whole game for offline play.
 */
function precacheManifest(): Plugin {
  let outDir = 'dist';
  return {
    name: 'berry-beats-precache-manifest',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const files = listFiles(outDir)
        .map((path) => relative(outDir, path).split(sep).join('/'))
        .filter((file) => !SKIP_PRECACHE.has(file))
        .sort();
      writeFileSync(join(outDir, 'precache-manifest.json'), JSON.stringify(files));
    },
  };
}

export default defineConfig({
  // Relative base so the build works from any static host or sub-path.
  base: './',
  define: {
    // Names the service worker's cache, so every deploy starts a fresh one.
    __BUILD_ID__: JSON.stringify(Date.now().toString(36)),
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
  },
  plugins: [precacheManifest()],
  server: { host: true },
  // Agent worktrees under .claude/ hold copies of the suite; run only this checkout's tests.
  test: { exclude: [...configDefaults.exclude, '.claude/**'] },
});
