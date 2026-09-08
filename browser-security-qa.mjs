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
  const target = await page.evaluate(async () => {
    const repo = await import('/dist/lib/repo.js');
    const db = await import('/dist/lib/db.js');
    await repo.resetToFixtures();

    const [titles, library, availability, metadata, seasons, episodes] = await Promise.all([
      repo.allTitles(), repo.allLibrary(), repo.allAvailability(), repo.allMetadata(), repo.allSeasons(), repo.allEpisodes()
    ]);
    const libraryIds = new Set(library.map((item) => item.titleId));
    const title = titles.find((item) => item.mediaType === 'series' && libraryIds.has(item.id) && availability.some((entry) => entry.titleId === item.id));
    if (!title) return null;

    const hostileTitle = '<img src=x onerror="window.__providerTitleXss=1"> Provider title';
    const hostileOverview = '<img src=x onerror="window.__providerOverviewXss=1"> Provider overview';
    const hostileSeason = '<img src=x onerror="window.__providerSeasonXss=1"> Season';
    const hostileEpisode = '<img src=x onerror="window.__providerEpisodeXss=1"> Episode';

    await db.put('titles', { ...title, title: hostileTitle });
    const meta = metadata.find((item) => item.titleId === title.id);
    if (meta) await db.put('title_metadata', { ...meta, overview: hostileOverview, genres: ['<img src=x onerror="window.__providerGenreXss=1"> Genre'] });
    const season = seasons.find((item) => item.titleId === title.id && episodes.some((episode) => episode.titleId === title.id && episode.seasonNumber === item.seasonNumber));
    if (season) await db.put('seasons', { ...season, name: hostileSeason });
    const episode = episodes.find((item) => item.titleId === title.id && (!season || item.seasonNumber === season.seasonNumber));
    if (episode) await db.put('episodes', { ...episode, name: hostileEpisode, overview: hostileOverview });
    const availabilityRow = availability.find((item) => item.titleId === title.id);
    if (availabilityRow) await db.put('availability', { ...availabilityRow, deepLink: 'javascript:window.__providerLinkXss=1' });

    return { id: title.id, seasonNumber: season?.seasonNumber ?? null, hostileTitle, hostileOverview, hostileSeason, hostileEpisode };
  });

  if (!target) {
    record('Synthetic provider-security target exists', false);
  } else {
    await page.goto(BASE + '/#/title/' + target.id);
    await page.waitForTimeout(200);
    const overviewSafe = await page.evaluate(({ hostileTitle, hostileOverview }) => {
      const text = document.querySelector('#app')?.textContent ?? '';
      return text.includes(hostileTitle) && text.includes(hostileOverview) &&
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
