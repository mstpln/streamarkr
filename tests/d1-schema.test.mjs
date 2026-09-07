import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

const migration = fs.readFileSync(new URL('../migrations/0001_initial.sql', import.meta.url), 'utf8');
function openMigratedDb() { const db = new DatabaseSync(':memory:'); db.exec(migration); return db; }

test('initial D1 migration applies cleanly and is idempotent', () => {
  const db = openMigratedDb();
  db.exec(migration);
  const version = db.prepare("SELECT value FROM app_meta WHERE key='schema_version'").get();
  assert.equal(version.value, '1');
  db.close();
});

test('canonical title identity enforces media type plus TMDB id uniqueness and key format', () => {
  const db = openMigratedDb();
  const insert = db.prepare("INSERT INTO titles(id, media_type, tmdb_id, title, year) VALUES (?, ?, ?, ?, ?)");
  insert.run('series-101', 'series', 101, 'Example', 2026);
  assert.throws(() => insert.run('series-duplicate', 'series', 101, 'Duplicate', 2026));
  assert.throws(() => insert.run('series-999', 'series', 102, 'Mismatched canonical id', 2026));
  insert.run('movie-101', 'movie', 101, 'Movie Example', 2026);
  db.close();
});

test('availability can store subscription and rent entries for the same title and service', () => {
  const db = openMigratedDb();
  db.prepare("INSERT INTO titles(id, media_type, tmdb_id, title, year) VALUES ('movie-1','movie',1,'One',2026)").run();
  const insert = db.prepare(`INSERT INTO availability (title_id, service_key, option_type, checked_at, source) VALUES (?, ?, ?, ?, ?)`);
  insert.run('movie-1', 'netflix', 'subscription', '2026-09-07T00:00:00Z', 'streaming-availability');
  insert.run('movie-1', 'netflix', 'rent', '2026-09-07T00:00:00Z', 'streaming-availability');
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM availability WHERE title_id='movie-1' AND service_key='netflix'").get().count, 2);
  db.close();
});

test('provider-owned title deletion cannot cascade-delete user-owned library state', () => {
  const db = openMigratedDb();
  db.prepare("INSERT INTO titles(id, media_type, tmdb_id, title, year) VALUES ('series-2','series',2,'Two',2026)").run();
  db.prepare("INSERT INTO library_items(title_id, added_at, derived_status, status_computed_at) VALUES ('series-2','2026-09-07T00:00:00Z','To Watch','2026-09-07T00:00:00Z')").run();
  assert.throws(() => db.prepare("DELETE FROM titles WHERE id='series-2'").run());
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM library_items WHERE title_id='series-2'").get().count, 1);
  db.close();
});

test('default services are registry rows only and do not preselect personal preferences', () => {
  const db = openMigratedDb();
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM services').get().count, 8);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM services WHERE user_selected=1').get().count, 0);
  db.close();
});
