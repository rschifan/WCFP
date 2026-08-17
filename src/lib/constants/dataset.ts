/**
 * The published deposit behind this portal.
 *
 * The portal serves no copy of the archive: figshare is the repository of record, so the DOI is the
 * download. Versioning, licence and download statistics stay in one place, and the site cannot drift
 * from the deposit the paper cites.
 *
 * The DOI carries figshare's deposit version (`.v2`) because that is the exact string the manuscript
 * prints in both the Background and Data Records sections, and figshare's own suggested citation
 * agrees. A reader comparing paper and portal should see one string, not two that resolve alike.
 */

export const WCFP_DATASET = {
	title: 'World Checklist of Food Plants 2026 (WCFP): Data',
	doi: '10.6084/m9.figshare.31441615.v2',
	url: 'https://doi.org/10.6084/m9.figshare.31441615.v2',
	repository: 'figshare',
	licence: 'CC BY 4.0',
	licenceUrl: 'https://creativecommons.org/licenses/by/4.0/',
	version: 'Version 2',
	posted: 'August 2026',
	archive: 'data-and-code.zip',
	archiveSize: '176 MB',
	/**
	 * figshare's own suggested citation from `api.figshare.com/v2/articles/31441615`, with two author
	 * names corrected: figshare has "Gorah, Sarah" for Sarah L. Gora, and "Khoury, Colin" without the
	 * middle initial the paper prints. Both come from the depositors' figshare profiles and are being
	 * fixed there; until they are, this string is the one place a reader would copy the misspelling
	 * from, so it is not left verbatim.
	 *
	 * Everything else stays as figshare composed it — the six-author cut, the trailing "et al.", the
	 * punctuation — because the repository decides how its deposits are cited, and a citation we
	 * write ourselves is one more string that can drift from the record it points at. Once the
	 * profiles are updated, re-copy from the API and drop this note.
	 */
	citation:
		'Diazgranados, Mauricio; Gianella, Maraeva; Kor, Laura; Gori, Benedetta; Khoury, Colin K.; Gora, Sarah L.; et al. (2026). World Checklist of Food Plants 2026 (WCFP): Data. figshare. Dataset. https://doi.org/10.6084/m9.figshare.31441615.v2'
} as const;

// The manuscript DOI is assigned on acceptance. Add it here and render it beside the dataset once
// it exists — a rendered "forthcoming" row says less than no row while the paper is in revision.
