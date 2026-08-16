// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		interface PageState {
			/**
			 * An open species scheda. Set by shallow routing so the dialog has a real URL: Back
			 * closes it instead of leaving the page, and a reload lands on /species/[wcfpId].
			 */
			scheda?: {
				wcfpId: number;
				view: 'overview' | 'distribution';
			};
		}
		// interface Platform {}
	}
}

export {};
