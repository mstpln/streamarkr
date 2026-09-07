// Discover / recommendation logic (section 12). Candidate generation is faked locally (no TMDB
// recommendation call), but the exclusion/eligibility/ranking rules are the real product logic.
import type { AvailabilityEntry, LibraryItem, MediaType, Rating, ServiceDef, Title, TitleMetadata, WatchEvent } from './types.js';

export interface DiscoverContext {
  titles: Title[];
  metadata: TitleMetadata[];
  libraryItems: LibraryItem[];
  historyTitleIds: Set<string>; // titles with any resolved watched activity
  availability: AvailabilityEntry[];
  services: ServiceDef[];
  ratings: Rating[];
}

function selectedServiceKeys(ctx: DiscoverContext): Set<string> {
  return new Set(ctx.services.filter((s) => s.userSelected).map((s) => s.serviceKey));
}

/** Subscription availability on a user-selected service only — never rent/buy, never an
 * unselected service (section 12.2's core eligibility rule). */
function eligibleAvailability(titleId: string, ctx: DiscoverContext): AvailabilityEntry[] {
  const selected = selectedServiceKeys(ctx);
  return ctx.availability.filter((a) => a.titleId === titleId && a.optionType === 'subscription' && selected.has(a.serviceKey));
}

function isEligibleBySubscription(titleId: string, ctx: DiscoverContext): boolean {
  return eligibleAvailability(titleId, ctx).length > 0;
}

function baseCandidates(mediaType: MediaType, ctx: DiscoverContext): Title[] {
  const libraryIds = new Set(ctx.libraryItems.map((i) => i.titleId));
  return ctx.titles.filter(
    (t) => t.mediaType === mediaType && !libraryIds.has(t.id) && !ctx.historyTitleIds.has(t.id) && isEligibleBySubscription(t.id, ctx)
  );
}

function genresOf(titleId: string, ctx: DiscoverContext): string[] {
  return ctx.metadata.find((m) => m.titleId === titleId)?.genres ?? [];
}

export interface DiscoverCard {
  title: Title;
  why: string;
  genres: string[];
  year: number;
  mediaType: MediaType;
  availability: AvailabilityEntry[];
  trailerKey: string | null;
}

function toCard(t: Title, ctx: DiscoverContext, why: string): DiscoverCard {
  return {
    title: t,
    why,
    genres: genresOf(t.id, ctx),
    year: t.year,
    mediaType: t.mediaType,
    availability: eligibleAvailability(t.id, ctx),
    trailerKey: ctx.metadata.find((m) => m.titleId === t.id)?.trailerKey ?? null
  };
}

/**
 * Correction 7: a shared preference score used to RANK candidates, not just filter them.
 * Every one of the user's ratings that shares at least one genre with the candidate contributes
 * — a 5-star rating counts for much more than a lower one, so "By Genre" (and the other views)
 * favor titles that resemble what the user has specifically loved, not just genre membership.
 * Deterministic given the same ratings/genre data, so it's safe to unit test.
 */
function preferenceScore(titleId: string, ctx: DiscoverContext): number {
  const candidateGenres = genresOf(titleId, ctx);
  if (candidateGenres.length === 0) return 0;
  let score = 0;
  for (const r of ctx.ratings) {
    if (r.titleId === titleId) continue;
    const ratedGenres = genresOf(r.titleId, ctx);
    const overlap = candidateGenres.filter((g) => ratedGenres.includes(g)).length;
    if (overlap === 0) continue;
    const weight = r.stars === 5 ? 3 : r.stars === 4 ? 2 : r.stars === 3 ? 1 : 0.5;
    score += overlap * weight;
  }
  return score;
}

function byScoreThenName(ctx: DiscoverContext) {
  return (a: Title, b: Title) => {
    const diff = preferenceScore(b.id, ctx) - preferenceScore(a.id, ctx);
    if (diff !== 0) return diff;
    return a.title.localeCompare(b.title);
  };
}

export function topPicks(mediaType: MediaType, ctx: DiscoverContext): DiscoverCard[] {
  const seeds = ctx.ratings.filter((r) => r.stars === 5).map((r) => r.titleId);
  const seedGenres = new Set(seeds.flatMap((id) => genresOf(id, ctx)));
  return baseCandidates(mediaType, ctx)
    .filter((t) => genresOf(t.id, ctx).some((g) => seedGenres.has(g)))
    .sort(byScoreThenName(ctx))
    .map((t) => toCard(t, ctx, 'Because you rated similar titles 5 stars'));
}

export function similarTo(seedTitleId: string, ctx: DiscoverContext): DiscoverCard[] {
  const seed = ctx.titles.find((t) => t.id === seedTitleId);
  if (!seed) return [];
  const seedGenres = new Set(genresOf(seed.id, ctx));
  return baseCandidates(seed.mediaType, ctx)
    .filter((t) => genresOf(t.id, ctx).some((g) => seedGenres.has(g)))
    .sort(byScoreThenName(ctx))
    .map((t) => toCard(t, ctx, `Similar to ${seed.title}`));
}

/** Correction 7: within the selected genre, rank by the user's rating-derived preference score
 * (5-star titles weigh heaviest) rather than returning generic genre matches in arbitrary order. */
export function byGenre(mediaType: MediaType, genre: string, ctx: DiscoverContext): DiscoverCard[] {
  return baseCandidates(mediaType, ctx)
    .filter((t) => genresOf(t.id, ctx).includes(genre))
    .sort(byScoreThenName(ctx))
    .map((t) => toCard(t, ctx, preferenceScore(t.id, ctx) > 0 ? `Popular in ${genre}, matching your taste` : `Popular in ${genre}`));
}

export function allGenres(ctx: DiscoverContext, mediaType: MediaType): string[] {
  const set = new Set<string>();
  for (const t of ctx.titles.filter((x) => x.mediaType === mediaType)) {
    for (const g of genresOf(t.id, ctx)) set.add(g);
  }
  return [...set].sort();
}
