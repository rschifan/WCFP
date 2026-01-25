/**
 * Contributor data structure for the about page
 */
export interface Contributor {
	/** Full name of the contributor */
	name: string;
	/** List of institutional affiliations */
	affiliations: string[];
	/** URL to contributor's photo/avatar (optional) */
	photo: string | null;
	/** Personal or institutional website URL (optional) */
	website: string | null;
}
