/*
 * Browser smoke test: serves the production build and plays through it.
 *
 *   npm run test:e2e        (builds first)
 *   node tests/e2e/smoke.cjs  (uses the existing dist/)
 *
 * Fails on any console error, page error or failed request, or if a step
 * does not reach the expected scene. Set PLAYWRIGHT_CHROMIUM_PATH to use a
 * Chromium that is already installed instead of Playwright's own download.
 */
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const DIST = path.resolve(__dirname, '..', '..', 'dist');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.mp3': 'audio/mpeg',
  '.ttf': 'font/ttf',
  '.css': 'text/css',
};

/** Minimal static file server for dist/ on a free port. */
function serve() {
  const server = http.createServer((request, response) => {
    const urlPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let file = path.join(DIST, urlPath);
    if (!file.startsWith(DIST)) file = DIST;
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) {
      response.writeHead(404).end('Not found');
      return;
    }
    response.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(response);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function main() {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) throw new Error('dist/ is missing: run "npm run build" first');
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const problems = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on('console', (message) => message.type() === 'error' && problems.push(`console error: ${message.text()}`));
    page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
    page.on('requestfailed', (request) => {
      // Moving to another page cancels downloads that were still running, which is not a fault.
      const reason = request.failure()?.errorText ?? '';
      if (!reason.includes('ERR_ABORTED')) problems.push(`request failed: ${request.url()} (${reason})`);
    });
    page.on('response', (response) => response.status() >= 400 && problems.push(`HTTP ${response.status()}: ${response.url()}`));

    const activeScene = () => page.evaluate(() => (window.__game ? window.__game.scene.getScenes(true).map((scene) => scene.scene.key) : []));
    const waitForScene = async (key, timeout = 20000) => {
      try {
        await page.waitForFunction((wanted) => window.__game && window.__game.scene.getScenes(true).some((scene) => scene.scene.key === wanted), key, { timeout });
      } catch {
        throw new Error(`expected the ${key} scene, but the active scenes were: ${(await activeScene()).join(', ') || 'none'}`);
      }
      // Scenes fade in and ignore input until the fade out of the previous one has finished.
      await page.waitForTimeout(600);
    };

    await page.goto(base);
    await waitForScene('Title');
    await page.keyboard.press('Enter');
    await waitForScene('Menu');
    // A new game opens on the prologue (story v2): the old final on tape.
    await page.keyboard.press('Enter');
    await waitForScene('Prologue');
    // Once it has been seen it can be skipped (hold Enter for a second); the story then starts in Berry's room.
    await page.evaluate(() =>
      localStorage.setItem('berrybeats.story.v1', JSON.stringify({ cleared: [], allies: [], talked: [], inspected: [], seen: ['prologue'] })),
    );
    await page.goto(`${base}?scene=Prologue`);
    await waitForScene('Prologue');
    // The cutscene is up once its art has loaded.
    await page.waitForFunction(() => !!window.__game.scene.getScene('Prologue').cut, null, { timeout: 20000 });
    await page.keyboard.down('Enter');
    await page.waitForTimeout(1500);
    await page.keyboard.up('Enter');
    await waitForScene('Explore');
    // Berry's room, with stop 1's arrival scene (the Coach at the window).
    await page.goto(`${base}?scene=Explore&stop=stop01&place=room`);
    await waitForScene('Explore');

    // With stop 1 won, the story opens on the train; a station and a street load their stand-in art.
    await page.evaluate(() =>
      localStorage.setItem('berrybeats.story.v1', JSON.stringify({ cleared: ['stop01'], allies: ['raspberry'], talked: [], inspected: [], seen: ['boarded'] })),
    );
    await page.goto(`${base}?scene=LevelSelect`);
    await waitForScene('LevelSelect');
    // Berry's moves, from the train's M key: the stop's won battles have taught him theirs.
    await page.waitForTimeout(1200);
    await page.keyboard.press('m');
    await waitForScene('Moves');
    const learned = await page.evaluate(() => JSON.parse(localStorage.getItem('berrybeats.moves.v1') || '{}').learned || []);
    if (!learned.includes('learn_stop01')) problems.push(`the moves of stop 1 were not granted from the story save (got ${learned.join(', ')})`);
    await page.goto(`${base}?scene=Explore&stop=stop02&place=station`);
    await waitForScene('Explore');
    await page.goto(`${base}?scene=Explore&stop=stop02&place=street`);
    await waitForScene('Explore');

    // The Grand Stage's crew battle: the lineup, then round 1 starts on the Grape's song.
    await page.goto(`${base}?scene=Lineup`);
    await waitForScene('Lineup');
    await page.keyboard.press('Enter');
    await waitForScene('Play');
    const round = await page.evaluate(() => window.__game.scene.getScene('Play').crew?.round ?? null);
    if (round !== 0) problems.push(`the crew battle did not start on round 1 (got ${round})`);

    // Let the tutorial play itself from near the end and check it reaches the results screen.
    await page.goto(`${base}?scene=Play&level=tutorial&autoplay=1&at=60`);
    await waitForScene('Play');
    await waitForScene('Results', 60000);
    const judged = await page.evaluate(() => window.__game.scene.getScene('Results').results?.stats?.judged ?? null);
    if (judged === 0) problems.push('the tutorial finished without judging any notes');
  } finally {
    await browser.close();
    server.close();
  }
  if (problems.length > 0) throw new Error(`Smoke test failed:\n  ${[...new Set(problems)].join('\n  ')}`);
  console.log('Smoke test passed: title, menu, the prologue and its skip, Berry\'s room, the train, the moves screen, a station, a street, the crew battle lineup, the tutorial and results all loaded without errors.');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
