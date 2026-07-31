import type {
  Category,
  Garment,
  Outfit,
  RecommendInput,
  Recommendation,
} from './types';

const CORE_CATEGORIES = new Set<Category>(['TOP', 'BOTTOM', 'DRESS', 'OUTER']);
const NEUTRAL_COLORS = new Set(['BLACK', 'WHITE', 'GRAY', 'BEIGE', 'BROWN', 'NAVY']);

export const canonicalIds = (ids: string[]) =>
  [...new Set(ids.filter(Boolean))].sort((a, b) => a.localeCompare(b));

export const normalize = (s: string) =>
  s.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ko-KR');

export const meetingKey = (s: string) => s.trim();

const core = (ids: string[], cats: Record<string, Category>) =>
  canonicalIds(ids.filter((id) => CORE_CATEGORIES.has(cats[id]))).join('|');

const outfitCore = (outfit: Outfit, cats: Record<string, Category>) => {
  const snapshotCategories = Object.fromEntries(
    outfit.items.map((item) => [item.garmentId, item.category]),
  );
  return core(outfit.garmentIds, { ...cats, ...snapshotCategories });
};

export function duplicateCheck(
  ids: string[],
  context: string,
  outfits: Outfit[],
  cats: Record<string, Category>,
) {
  const key = canonicalIds(ids).join('|');
  const contextKey = meetingKey(context);
  const currentCore = core(ids, cats);
  const live = outfits
    .filter((outfit) => !outfit.deletedAt && outfit.status === 'CONFIRMED')
    .sort(
      (a, b) =>
        b.localDate.localeCompare(a.localDate) ||
        b.createdAt.localeCompare(a.createdAt) ||
        b.id.localeCompare(a.id),
    );
  const sameContext = live.filter(
    (outfit) =>
      meetingKey(outfit.contextName) === contextKey,
  );
  const exact = sameContext.filter((outfit) => outfit.combinationKey === key);
  if (exact.length) return { kind: 'exact' as const, match: exact[0], matches: exact };

  const coreMatches = currentCore
    ? sameContext.filter((outfit) => outfitCore(outfit, cats) === currentCore)
    : [];
  if (coreMatches.length) return { kind: 'core' as const, match: coreMatches[0], matches: coreMatches };

  const other = live.filter((outfit) => outfit.combinationKey === key);
  return other.length
    ? { kind: 'other' as const, match: other[0], matches: other }
    : { kind: 'none' as const };
}

function otherContextMatch(
  ids: string[],
  context: string,
  outfits: Outfit[],
  cats: Record<string, Category>,
) {
  const key = canonicalIds(ids).join('|');
  const currentCore = core(ids, cats);
  const contextKey = meetingKey(context);
  const other = outfits
    .filter(
      (outfit) =>
        !outfit.deletedAt &&
        outfit.status === 'CONFIRMED' &&
        meetingKey(outfit.contextName) !== contextKey,
    )
    .sort(
      (a, b) =>
        b.localDate.localeCompare(a.localDate) ||
        b.createdAt.localeCompare(a.createdAt) ||
        b.id.localeCompare(a.id),
    );
  const match = other.find(
    (outfit) =>
      outfit.combinationKey === key ||
      Boolean(currentCore && outfitCore(outfit, cats) === currentCore),
  );
  if (!match) return undefined;
  return {
    outfit: match,
    kind: match.combinationKey === key ? ('exact' as const) : ('core' as const),
  };
}

export function recentFour(
  outfits: Outfit[],
  context: string,
  targetDate = '9999-12-31',
  editingId?: string,
) {
  const key = meetingKey(context);
  return outfits
    .filter(
      (outfit) =>
        outfit.id !== editingId &&
        !outfit.deletedAt &&
        outfit.status === 'CONFIRMED' &&
        outfit.localDate < targetDate &&
        (!key || meetingKey(outfit.contextName) === key),
    )
    .sort(
      (a, b) =>
        b.localDate.localeCompare(a.localDate) ||
        b.createdAt.localeCompare(a.createdAt) ||
        b.id.localeCompare(a.id),
    )
    .slice(0, 4);
}

const seasonFor = (date: string) => {
  const month = Number(date.slice(5, 7));
  if (month >= 3 && month <= 5) return 'SPRING';
  if (month >= 6 && month <= 8) return 'SUMMER';
  if (month >= 9 && month <= 11) return 'AUTUMN';
  return 'WINTER';
};

interface RankedRecommendation extends Recommendation {
  rank: {
    recentAppearances: number;
    recentCoreItems: number;
    seasonMismatches: number;
    colorNeedsCheck: number;
    lastWornDates: string[];
  };
}

function compareDateVectors(a: string[], b: string[]) {
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const comparison = (a[index] ?? '').localeCompare(b[index] ?? '');
    if (comparison) return comparison;
  }
  return 0;
}

export function recommend(
  garments: Garment[],
  outfits: Outfit[],
  input: RecommendInput,
): Recommendation[] {
  if (!Number.isFinite(input.limit) || input.limit < 1) {
    throw new Error('limit must be at least 1');
  }

  const active = garments.filter(
    (garment) => garment.status === 'ACTIVE' && !garment.deletedAt,
  );
  const byCategory = (category: Category) =>
    active
      .filter((garment) => garment.category === category)
      .sort((a, b) => a.id.localeCompare(b.id));

  const bases: Garment[][] = [
    ...byCategory('TOP').flatMap((top) =>
      byCategory('BOTTOM').map((bottom) => [top, bottom]),
    ),
    ...byCategory('DRESS').map((dress) => [dress]),
  ];
  const withOptions = (base: Garment[]) => {
    const candidates: Garment[][] = [];
    for (const outer of [undefined, ...byCategory('OUTER')]) {
      for (const shoes of [undefined, ...byCategory('SHOES')]) {
        candidates.push([
          ...base,
          ...([outer, shoes].filter(Boolean) as Garment[]),
        ]);
      }
    }
    return candidates;
  };

  const recent = recentFour(outfits, input.contextName, input.targetLocalDate);
  const past = outfits.filter(
    (outfit) =>
      !outfit.deletedAt &&
      outfit.status === 'CONFIRMED' &&
      outfit.localDate < input.targetLocalDate,
  );
  const categories = Object.fromEntries(
    active.map((garment) => [garment.id, garment.category]),
  ) as Record<string, Category>;
  const targetSeason = seasonFor(input.targetLocalDate);
  const lastWorn: Record<string, string | null> = {};
  for (const garment of active) {
    lastWorn[garment.id] =
      past
        .filter((outfit) => outfit.garmentIds.includes(garment.id))
        .sort((a, b) => b.localDate.localeCompare(a.localDate))[0]?.localDate ?? null;
  }

  const ranked = bases
    .flatMap(withOptions)
    .map((candidate): RankedRecommendation => {
      const ids = canonicalIds(candidate.map((garment) => garment.id));
      const combinationKey = ids.join('|');
      const coreGarments = candidate.filter((garment) =>
        CORE_CATEGORIES.has(garment.category),
      );
      const appearances = coreGarments.map(
        (garment) =>
          recent.filter((outfit) => outfit.garmentIds.includes(garment.id)).length,
      );
      const recentAppearances = appearances.reduce((sum, count) => sum + count, 0);
      const recentCoreItems = appearances.filter((count) => count > 0).length;
      const seasonMismatches = candidate.filter(
        (garment) =>
          !garment.seasons.includes('ALL') && !garment.seasons.includes(targetSeason),
      ).length;
      const coreColors = coreGarments.map((garment) => garment.color);
      const harmony =
        coreColors.length < 2 ||
        coreColors.some((color) => NEUTRAL_COLORS.has(color)) ||
        new Set(coreColors).size === 1;
      const otherMatch = otherContextMatch(ids, input.contextName, past, categories);
      const reasonCodes = [
        recentAppearances === 0 ? 'NOT_USED_IN_RECENT_4' : 'OLDER_IN_RECENT_4',
        ...(candidate.some((garment) => lastWorn[garment.id] === null)
          ? ['NEVER_WORN']
          : []),
        ...(seasonMismatches ? ['SEASON_MISMATCH'] : []),
        ...(harmony ? ['COLOR_STRONG'] : []),
        ...(otherMatch ? ['OTHER_CONTEXT_DUPLICATE'] : []),
      ];
      return {
        garmentIds: ids,
        combinationKey,
        score:
          1000 -
          recentAppearances * 100 -
          recentCoreItems * 20 -
          seasonMismatches * 10 -
          (harmony ? 0 : 5),
        reasonCodes,
        lastWorn: Object.fromEntries(ids.map((id) => [id, lastWorn[id]])),
        otherContextMatch: otherMatch
          ? {
              localDate: otherMatch.outfit.localDate,
              contextName: otherMatch.outfit.contextName,
              kind: otherMatch.kind,
            }
          : undefined,
        rank: {
          recentAppearances,
          recentCoreItems,
          seasonMismatches,
          colorNeedsCheck: harmony ? 0 : 1,
          lastWornDates: coreGarments
            .map((garment) => lastWorn[garment.id] ?? '')
            .sort((a, b) => a.localeCompare(b)),
        },
      };
    })
    .filter((candidate) => {
      const duplicate = duplicateCheck(
        candidate.garmentIds,
        input.contextName,
        past,
        categories,
      );
      return duplicate.kind !== 'exact' && duplicate.kind !== 'core';
    })
    .sort(
      (a, b) =>
        a.rank.recentAppearances - b.rank.recentAppearances ||
        a.rank.recentCoreItems - b.rank.recentCoreItems ||
        a.rank.seasonMismatches - b.rank.seasonMismatches ||
        a.rank.colorNeedsCheck - b.rank.colorNeedsCheck ||
        compareDateVectors(a.rank.lastWornDates, b.rank.lastWornDates) ||
        a.combinationKey.localeCompare(b.combinationKey),
    )
    .slice(0, input.limit);

  return ranked.map((candidate) => ({
    garmentIds: candidate.garmentIds,
    combinationKey: candidate.combinationKey,
    score: candidate.score,
    reasonCodes: candidate.reasonCodes,
    lastWorn: candidate.lastWorn,
    otherContextMatch: candidate.otherContextMatch,
  }));
}
