import { BROWSER } from 'esm-env';
import { on } from 'svelte/events';
import { createSubscriber } from 'svelte/reactivity';

export interface DocumentVisible {
	readonly current: boolean | undefined;
}

const subscribe = createSubscriber((update) => on(document, 'visibilitychange', update));

export const documentVisible: DocumentVisible = {
	get current() {
		if (!BROWSER) return undefined;
		subscribe();
		return document.visibilityState === 'visible';
	}
};
