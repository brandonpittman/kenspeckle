/** Structural, not imported from Kit — any router handing over a completion promise fits. */
export interface Navigation {
	complete: Promise<void>;
	type?: string;
	/** Optional because SvelteKit 2 has no such field; only Kit 3 reports it. */
	shallow?: boolean;
	delta?: number | null;
	from?: { url: URL } | null;
	to?: { url: URL } | null;
}
