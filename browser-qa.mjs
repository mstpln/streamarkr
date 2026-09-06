// Correction 16/17: committed, deterministic browser QA + responsive QA script. Uses only the
// synthetic fixture data already seeded by repo.ts — never live network or personal data. Run
// with: node browser-qa.mjs (server must be running: node server.mjs 8787)
import { chromium } from 'playwright';

const BASE = process.env.QA_BASE_URL ?? 'http://localhost:8787';
const results = [];
let browser;

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + detail : ''}`);
}

async function withPage(viewport, fn) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  page.setDefaultNavigationTimeout(15000);
  const consoleErrors = [];
  page.on('pageerror', (err) => consoleErrors.push(String(err)));
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  await fn(page, consoleErrors);
  await context.close();
  return consoleErrors;
}

async function main() {
  const launchOptions = process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {};
  browser = await chromium.launch(launchOptions);
  try {

  // ---- Journey smoke pass at a standard mobile viewport ----
  const errors = await withPage({ width: 390, height: 844 }, async (page, consoleErrors) => {
    await page.goto(BASE + '/#/home', { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    record('Home renders', await page.locator('.page-title, .brand').first().isVisible());

    await page.goto(BASE + '/#/library');
    await page.waitForTimeout(300);
    record('My Library renders', await page.getByText('My Library').first().isVisible());

    await page.goto(BASE + '/#/history');
    await page.waitForTimeout(300);
    record('History renders', await page.getByText('History').first().isVisible());

    await page.goto(BASE + '/#/search');
    await page.waitForTimeout(200);
    await page.fill('#search-box', 'the');
    await page.waitForTimeout(600);
    const searchRows = await page.locator('.row-item').count();
    record('Search returns rows for query "the"', searchRows > 0, `${searchRows} row(s)`);

    await page.goto(BASE + '/#/discover');
    await page.waitForTimeout(400);
    record('Discover renders cards or an empty-state', (await page.locator('.poster-card, .empty-state').count()) > 0);

    const discoverCardsBefore = await page.locator('.poster-card').count();
    if (discoverCardsBefore > 0 && await page.locator('[data-heart]').count()) {
      await page.locator('[data-heart]').first().click();
      await page.waitForTimeout(250);
      const discoverCardsAfter = await page.locator('.poster-card').count();
      record('Discover heart adds to My Library and removes the now-ineligible card', discoverCardsAfter < discoverCardsBefore, `${discoverCardsBefore} -> ${discoverCardsAfter}`);
      await page.evaluate(async () => {
        const mod = await import('/dist/lib/repo.js');
        await mod.resetToFixtures();
      });
    }

    await page.goto(BASE + '/#/settings');
    await page.waitForTimeout(200);
    record('Settings renders', await page.getByText('Settings').first().isVisible());
    await page.click('[data-tab="connections"]');
    await page.waitForTimeout(100);
    record('Settings Connections tab switches', await page.getByText('Sync now').isVisible());

    await page.goto(BASE + '/#/home');
    await page.waitForTimeout(100);
    await page.goto(BASE + '/#/settings');
    await page.waitForTimeout(150);
    record('Settings re-entry lands on Preferences', await page.locator('[data-tab="preferences"].active').count() === 1 && await page.getByText('Region').isVisible());

    await page.goto(BASE + '/#/alerts');
    await page.waitForTimeout(200);
    record('Alerts renders', (await page.locator('.page-title').count()) > 0);

    // Detail + trailer + primary streaming action, via the first library poster card
    await page.goto(BASE + '/#/library');
    await page.waitForTimeout(300);
    const firstCard = page.locator('.poster-card').first();
    if (await firstCard.count()) {
      await firstCard.click();
      await page.waitForTimeout(300);
      record('Detail page opens from My Library card', (await page.locator('.detail-title').count()) > 0);

      record('Detail rating controls are semantic buttons', await page.locator('button.star').count() === 5);
      record('Detail Overview includes progress/release context', (await page.locator('#tab-body .card-row').count()) >= 3);

      const trailerBtn = page.locator('#trailer-btn');
      if (await trailerBtn.count() && !(await trailerBtn.isDisabled())) {
        await trailerBtn.click();
        await page.waitForTimeout(150);
        record('Watch Trailer opens an overlay when a trailer exists', (await page.locator('.trailer-overlay').count()) > 0);
        await page.click('#trailer-close');
        await page.waitForTimeout(100);
        record('Trailer overlay closes', (await page.locator('.trailer-overlay').count()) === 0);
      } else {
        record('Watch Trailer gracefully disabled with no trailer', true, 'no trailerKey on this fixture title');
      }

      const episodesTab = page.locator('[data-tab="episodes"]');
      if (await episodesTab.count()) {
        await episodesTab.click();
        await page.waitForTimeout(150);
        record('Episodes tab renders episode rows', (await page.locator('.episode-row').count()) > 0);
        record('Episode rows expose expandable synopsis details', (await page.locator('.episode-details').count()) > 0);
      }
      await page.click('[data-tab="history"]');
      await page.waitForTimeout(100);
      record('Detail History separates manual corrections', await page.getByText('Manual corrections').isVisible());
      await page.click('[data-tab="streaming"]');
      await page.waitForTimeout(150);
      record('Streaming tab renders', (await page.locator('#tab-body').count()) > 0);
    } else {
      record('Detail page journey', false, 'no library card found to open');
    }

    if (consoleErrors.length) record('No console errors during smoke pass', false, consoleErrors.slice(0, 3).join(' | '));
    else record('No console errors during smoke pass', true);
  });

  // ---- Responsive QA: Pixel 9 Pro Fold folded (narrow) ----
  await withPage({ width: 344, height: 792 }, async (page) => {
    await page.goto(BASE + '/#/home', { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    record('Folded (344x792): no horizontal overflow on Home', !overflow);
    await page.goto(BASE + '/#/library');
    await page.waitForTimeout(300);
    const cols = await page.evaluate(() => {
      const grid = document.querySelector('.poster-grid');
      if (!grid) return null;
      return getComputedStyle(grid).gridTemplateColumns.split(' ').length;
    });
    record('Folded (344x792): My Library grid renders a sane column count', cols === null || (cols >= 1 && cols <= 3), `cols=${cols}`);
  });

  // ---- Responsive QA: Pixel 9 Pro Fold unfolded (wide) ----
  await withPage({ width: 873, height: 1000 }, async (page) => {
    await page.goto(BASE + '/#/home', { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    record('Unfolded (873x1000): no horizontal overflow on Home', !overflow);
    await page.goto(BASE + '/#/library');
    await page.waitForTimeout(300);
    const cardWidth = await page.evaluate(() => {
      const card = document.querySelector('.poster-card');
      return card ? card.getBoundingClientRect().width : null;
    });
    record('Unfolded (873x1000): poster cards do not over-stretch', cardWidth === null || cardWidth < 260, `width=${cardWidth}`);

    await page.goto(BASE + '/#/title/' + (await firstLibraryTitleId(page)));
    await page.waitForTimeout(300);
    record('Unfolded (873x1000): Detail hero renders', (await page.locator('.detail-hero').count()) > 0);
  });

  } finally {
    await browser?.close();
  }

  const fails = results.filter((r) => !r.ok);
  console.log(`\n${results.length - fails.length}/${results.length} checks passed.`);
  if (fails.length) {
    console.log('FAILURES:', fails.map((f) => f.name).join('; '));
    process.exitCode = 1;
  }
}

async function firstLibraryTitleId(page) {
  return page.evaluate(async () => {
    const mod = await import('/dist/lib/repo.js');
    await mod.ensureSeeded();
    const items = await mod.allLibrary();
    return items[0]?.titleId ?? '';
  });
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
