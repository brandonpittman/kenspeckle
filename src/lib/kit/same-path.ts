import { normalizeUrl } from '@sveltejs/kit';

// Configured paths often keep a trailing slash; Kit strips it from navigation targets, so a bare === matches nothing.
export function samePath(
	to: { url: URL } | null | undefined,
	target: string | null | undefined
): boolean {
	if (!to || !target) return false;
	return normalizeUrl(to.url.pathname).url.pathname === normalizeUrl(target).url.pathname;
}
