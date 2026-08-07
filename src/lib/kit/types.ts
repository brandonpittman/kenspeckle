/** Structural, not imported from Kit — any router handing over a completion promise fits. */
export interface Navigation {
	complete: Promise<void>;
	type?: string;
	from?: { url: URL } | null;
	to?: { url: URL } | null;
}
