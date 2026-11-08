import type { onNavigate } from '$app/navigation';

/**
 * Kit 2 exports `OnNavigate` from `@sveltejs/kit`, Kit 3 only from `$app/navigation`; deriving it
 * from `onNavigate`, which both export, resolves on either.
 */
export type OnNavigate = Parameters<Parameters<typeof onNavigate>[0]>[0];
