import { describe, expect, it } from 'vitest';
import { buildTaxonomyTraitBadges } from './presets';

/**
 * The occurrence badge is the only place a reader learns that a taxon is introduced *here*
 * without filtering to find out. It travels through two hops that both silently drop unknown
 * fields — the trait entry on the node, and the trait source handed to the badge builder — so
 * it is worth pinning rather than assuming.
 */
describe('occurrence status badge', () => {
	it('renders a badge for each status, tone-coded', () => {
		const cases = [
			{ status: 'native', tone: 'lime' },
			{ status: 'introduced', tone: 'orange' },
			{ status: 'extinct', tone: 'rose' },
			{ status: 'doubtful', tone: 'slate' }
		] as const;

		for (const { status, tone } of cases) {
			const badges = buildTaxonomyTraitBadges({
				occurrenceStatus: status,
				lifeforms: [],
				uses: []
			});

			const badge = badges.find((b) => b.id.endsWith(':occurrence'));
			expect(badge, `no badge for ${status}`).toBeDefined();
			expect(badge?.label).toBe(status);
			expect(badge?.tone).toBe(tone);
			expect(badge?.ariaLabel).toBe(`Recorded as ${status} in this region`);
		}
	});

	it('leads the badge row, so status reads before the trait icons', () => {
		const badges = buildTaxonomyTraitBadges({
			occurrenceStatus: 'introduced',
			lifeforms: ['tree'],
			uses: ['humanFood'],
			hasCwr: true
		});

		expect(badges[0].id).toMatch(/:occurrence$/);
		expect(badges.length).toBeGreaterThan(1);
	});

	it('emits nothing when the taxon is not region-scoped', () => {
		const badges = buildTaxonomyTraitBadges({ lifeforms: ['tree'], uses: [] });
		expect(badges.some((b) => b.id.endsWith(':occurrence'))).toBe(false);
	});
});
