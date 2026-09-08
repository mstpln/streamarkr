// Focused stored-markup / unsafe-provider-link regression QA. Uses synthetic IndexedDB data only.
import { chromium } from 'playwright';

const BASE = process.env.QA_BASE_URL ?? 'http://localhost:8787';
const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {});
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

const results = [];
function record(name, ok) {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}`);
}

try {
  await page.goto(BASE + '/#/home', { waitUntil: 'networkidle' });

  await page.evaluate(async () => {
    const repo = await import('/dist/lib/repo.js');
    await repo.resetToFixtures();
  });
  await page.goto(BASE + '/#/settings');
  await page.waitForTimeout(100);
  await page.fill('#new-svc', 'constructor');
  await page.click('#add-svc');
  await page.waitForTimeout(100);
  const prototypeKeySafe = await page.evaluate(() => {
    const text = document.querySelector('#settings-body')?.textContent ?? '';
    const logo = Array.from(document.querySelectorAll('#settings-body .svc-logo')).find((item) => item.getAttribute('aria-label') === 'constructor');
    return text.includes('constructor') && !!logo;
  });
  record('Custom service prototype-like keys render with fallback branding', prototypeKeySafe);

  const target = await page.evaluate(async () => {
    const repo = await import('/dist/lib/repo.js');
    const db = await import('/dist/lib/db.js');
    await repo.resetToFixtures();

    const [titles, library, availability, metadata, seasons, episodes, events] = await Promise.all([
      repo.allTitles(), repo.allLibrary(), repo.allAvailability(), repo.allMetadata(), repo.allSeasons(), repo.allEpisodes(), repo.allEvents()
    ]);
    const libraryIds = new Set(library.map((item) => item.titleId));
    const historyIds = new Set(events.map((item) => item.titleId));
    const title = titles.find((item) => item.mediaType === 'series' && libraryIds.has(item.id) && historyIds.has(item.id) && availability.some((entry) => entry.titleId === item.id));
    if (!title) return null;

    const hostileTitle = '<img src=x onerror="window.__providerTitleXss=1"> Provider title';
    const hostileOverview = '<img src=x onerror="window.__providerOverviewXss=1"> Provider overview';
    const hostileGenre = '<img src=x onerror="window.__providerGenreXss=1"> Genre';
    const hostileSeason = '<img src=x onerror="window.__providerSeasonXss=1"> Season';
    const hostileEpisode = '<img src=x onerror="window.__providerEpisodeXss=1"> Episode';
    const hostileAlert = '<img src=x onerror="window.__providerAlertXss=1"> Provider alert';

    await db.put('titles', { ...title, title: hostileTitle });
    const meta = metadata.find((item) => item.titleId === title.id);
    if (meta) await db.put('title_metadata', { ...meta, overview: hostileOverview, genres: [hostileGenre] });
    const season = seasons.find((item) => item.titleId === title.id && episodes.some((episode) => episode.titleId === title.id && episode.seasonNumber === item.seasonNumber));
    if (season) await db.put('seasons', { ...season, name: hostileSeason });
    const episode = episodes.find((item) => item.titleId === title.id && (!season || item.seasonNumber === season.seasonNumber));
    if (episode) await db.put('episodes', { ...episode, name: hostileEpisode, overview: hostileOverview });
    const availabilityRow = availability.find((item) => item.titleId === title.id);
    if (availabilityRow) await db.put('availability', { ...availabilityRow, deepLink: 'javascript:window.__providerLinkXss=1' });
    await db.put('alerts', {
      id: 'alert-security-provider-markup',
      titleId: title.id,
      alertType: 'new_episode_available',
      message: hostileAlert,
      eventDate: null,
      createdAt: '2099-01-01T00:00:00.000Z',
      seenAt: null,
      dedupeKey: 'security-provider-markup'
    });

    return { id: title.id, seasonNumber: season?.seasonNumber ?? null, hostileTitle, hostileOverview, hostileGenre, hostileSeason, hostileEpisode, hostileAlert };
  });

  if (!target) {
    record('Synthetic provider-security target exists', false);
  } else {
    await page.goto(BASE + '/#/title/' + target.id);
    await page.waitForTimeout(200);
    const overviewSafe = await page.evaluate(({ hostileTitle, hostileOverview, hostileGenre }) => {
      const text = document.querySelector('#app')?.textContent ?? '';
      return text.includes(hostileTitle) && text.includes(hostileOverview) && text.includes(hostileGenre) &&
        !document.querySelector('#app img[src="x"]') &&
        !window.__providerTitleXss && !window.__providerOverviewXss && !window.__providerGenreXss;
    }, target);
    record('Detail escapes provider title, overview and genre markup', overviewSafe);

    const episodesTab = page.locator('[data-tab="episodes"]');
    if (await episodesTab.count() && target.seasonNumber !== null) {
      await episodesTab.click();
      await page.waitForTimeout(100);
      const seasonButton = page.locator(`[data-season="${target.seasonNumber}"]`);
      if (await seasonButton.count()) {
        await seasonButton.click();
        await page.waitForTimeout(100);
      }
      const episodeSafe = await page.evaluate(({ hostileSeason, hostileEpisode, hostileOverview }) => {
        const text = document.querySelector('#tab-body')?.textContent ?? '';
        return text.includes(hostileSeason) && text.includes(hostileEpisode) && text.includes(hostileOverview) &&
          !document.querySelector('#tab-body img[src="x"]') &&
          !window.__providerSeasonXss && !window.__providerEpisodeXss && !window.__providerOverviewXss;
      }, target);
      record('Detail escapes provider season and episode markup', episodeSafe);
    } else {
      record('Detail escapes provider season and episode markup', false);
    }

    await page.click('[data-tab="streaming"]');
    await page.waitForTimeout(100);
    const unsafeLinkBlocked = await page.evaluate(() => {
      const unsafe = Array.from(document.querySelectorAll('#tab-body a')).some((anchor) => anchor.getAttribute('href')?.trim().toLowerCase().startsWith('javascript:'));
      return !unsafe && !window.__providerLinkXss;
    });
    record('Detail rejects unsafe provider deep-link protocols', unsafeLinkBlocked);

    await page.goto(BASE + '/#/library');
    await page.waitForTimeout(150);
    const librarySafe = await page.evaluate(({ hostileTitle, hostileGenre }) => {
      const text = document.querySelector('#app')?.textContent ?? '';
      return text.includes(hostileTitle) && text.includes(hostileGenre) &&
        !document.querySelector('#app img[src="x"]') && !window.__providerTitleXss && !window.__providerGenreXss;
    }, target);
    record('Library escapes provider title and genre markup', librarySafe);

    await page.goto(BASE + '/#/history');
    await page.waitForTimeout(150);
    const historySafe = await page.evaluate(({ hostileTitle, hostileGenre }) => {
      const text = document.querySelector('#app')?.textContent ?? '';
      return text.includes(hostileTitle) && text.includes(hostileGenre) &&
        !document.querySelector('#app img[src="x"]') && !window.__providerTitleXss && !window.__providerGenreXss;
    }, target);
    record('History escapes provider title and genre markup', historySafe);

    await page.goto(BASE + '/#/alerts');
    await page.waitForTimeout(150);
    const alertSafe = await page.evaluate(({ hostileAlert }) => {
      const text = document.querySelector('#app')?.textContent ?? '';
      return text.includes(hostileAlert) && !document.querySelector('#app img[src="x"]') && !window.__providerAlertXss;
    }, target);
    record('Alerts escape provider-derived message markup', alertSafe);
  }

  record('Provider-security QA has zero console/page errors', errors.length === 0);
} finally {
  await page.evaluate(async () => {
    const repo = await import('/dist/lib/repo.js');
    await repo.resetToFixtures();
  }).catch(() => {});
  await context.close();
  await browser.close();
}

const failures = results.filter((result) => !result.ok);
console.log(`\n${results.length - failures.length}/${results.length} provider-security checks passed.`);
if (failures.length) process.exitCode = 1;
