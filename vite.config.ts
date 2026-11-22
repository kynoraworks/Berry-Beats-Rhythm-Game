import { existsSync, readdirSync, writeFileSync } from 'node:fs';
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

/** Folders under public/ whose file names the story cutscenes look up (src/cutscene/storyFiles.ts). */
const STORY_DIRS = ['assets/img', 'assets/audio/story', 'charts'];
const STORY_FILES_ID = 'virtual:story-files';

/**
 * A module listing the files that are in public/assets/img, public/assets/audio/story
 * and public/charts, so the cutscenes load generated art and music by key once it lands
 * (and never request a file that is not there). Rebuilt when files are added in dev.
 */
function storyFiles(): Plugin {
  const resolved = `\0${STORY_FILES_ID}`;
  const scan = (): string[] =>
    STORY_DIRS.flatMap((dir) => {
      const full = join('public', dir);
      return existsSync(full) ? readdirSync(full, { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => `${dir}/${entry.name}`) : [];
    }).sort();
  return {
    name: 'berry-beats-story-files',
    resolveId: (id) => (id === STORY_FILES_ID ? resolved : null),
    load: (id) => (id === resolved ? `export default ${JSON.stringify(scan())};` : null),
    configureServer(server) {
      const refresh = (path: string) => {
        if (!STORY_DIRS.some((dir) => path.split(sep).join('/').includes(`public/${dir}/`))) return;
        const module = server.moduleGraph.getModuleById(resolved);
        if (module) server.moduleGraph.invalidateModule(module);
      };
      server.watcher.on('add', refresh);
      server.watcher.on('unlink', refresh);
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
  plugins: [precacheManifest(), storyFiles()],
  server: { host: true },
  // Agent worktrees under .claude/ hold copies of the suite; run only this checkout's tests.
  test: { exclude: [...configDefaults.exclude, '.claude/**'] },
});
