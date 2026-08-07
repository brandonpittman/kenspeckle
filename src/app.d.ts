// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Platform {
			env: Env;
			ctx: ExecutionContext;
			caches: CacheStorage;
			cf?: IncomingRequestCfProperties;
		}

		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
	}

	// Probes written by the view-transition demo layout, read by its e2e.
	interface Window {
		__vtStart?: string;
		__vtAttr?: string;
		__vtSettle?: string;
		__vtSettleAttr?: string;
	}
}

export {};
