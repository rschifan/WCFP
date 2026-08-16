/**
 * Finding the links inside a bibliographic reference.
 *
 * The `references_all` column is free text written by many hands, and roughly 24,000 taxa carry a
 * URL somewhere in it — as `https://…`, as a bare `www.…`, or as `doi:10.5063/F1CV4G34`. Readers
 * expect those to be clickable.
 *
 * The bar for linking is deliberately high: a wrong link is worse than no link, because it looks
 * authoritative and lands the reader on a 404. Anything that does not parse as a URL, or that
 * cannot be told apart from the prose around it, is left as plain text.
 *
 * Segments are returned rather than an HTML string on purpose: the reference text is data, and
 * rendering it through `{@html}` would make every citation an injection site. The caller walks the
 * segments and lets Svelte escape each one.
 */

/** URLs, bare hosts, and DOIs. Semicolons never appear inside one — they separate references. */
const LINK_PATTERN = /(https?:\/\/[^\s;]+|www\.[^\s;]+|doi:\s*10\.[^\s;]+)/gi;

/** Sentence punctuation that gets swept up by the greedy match but is not part of the target. */
const TRAILING_PUNCTUATION = /[.,;:!?)\]}>'"]+$/;

/** A host worth trusting: dotted, and ending in letters rather than a truncated fragment. */
const PLAUSIBLE_HOST =
	/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/i;

export interface ReferenceSegment {
	text: string;
	/** Absolute URL when this segment is a link, null when it is plain prose. */
	href: string | null;
}

function toHref(token: string): string | null {
	const lower = token.toLowerCase();

	if (lower.startsWith('doi:')) {
		const id = token.slice(4).trim();
		return /^10\.\d{4,9}\/\S+$/.test(id) ? `https://doi.org/${id}` : null;
	}

	const candidate = lower.startsWith('www.') ? `https://${token}` : token;

	let parsed: URL;
	try {
		parsed = new URL(candidate);
	} catch {
		return null;
	}

	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
	// Credentials in a bibliography are a parsing accident, never a real citation.
	if (parsed.username || parsed.password) return null;
	if (!PLAUSIBLE_HOST.test(parsed.hostname)) return null;

	return candidate;
}

/**
 * Whether a URL cut at a space has probably taken a word of prose with it.
 *
 * The checklist contains entries like `…Smithsonian Institute
 * http://botany.si.edu/antilles/West Indies (As var. ambigua)`, where "West Indies" is the title
 * of the resource rather than a path. Matching to the first space yields `…/antilles/West`, which
 * parses cleanly and is entirely wrong.
 *
 * The tell is a final path segment that begins with a capital, followed in the source by another
 * capitalised word — a phrase continuing, not a path ending. Lower-case continuations are left
 * alone, so `doi:10.5063/F1CV4G34 and later work` still links.
 */
function looksCutMidPhrase(token: string, rest: string): boolean {
	const lastSegment = token.split('/').pop() ?? '';
	if (!/^[A-Z]/.test(lastSegment)) return false;

	return /^\s+[A-Z]/.test(rest);
}

/**
 * Split a reference into plain and linkable segments, in order. A reference with no usable link
 * comes back as a single plain segment, so callers need no special case.
 */
export function linkifyReference(reference: string): ReferenceSegment[] {
	const segments: ReferenceSegment[] = [];
	let lastIndex = 0;

	for (const match of reference.matchAll(LINK_PATTERN)) {
		const raw = match[0];
		const start = match.index ?? 0;

		// Punctuation that trails the URL belongs to the sentence, not the link.
		const trailing = raw.match(TRAILING_PUNCTUATION)?.[0] ?? '';
		const token = trailing ? raw.slice(0, -trailing.length) : raw;

		const href = toHref(token);
		if (!href) continue;
		if (looksCutMidPhrase(token, reference.slice(start + token.length))) continue;

		if (start > lastIndex) {
			segments.push({ text: reference.slice(lastIndex, start), href: null });
		}

		segments.push({ text: token, href });
		lastIndex = start + token.length;
	}

	if (lastIndex < reference.length) {
		segments.push({ text: reference.slice(lastIndex), href: null });
	}

	return segments.length > 0 ? segments : [{ text: reference, href: null }];
}
