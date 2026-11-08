import { parse, stringify } from 'devalue';
import { BROWSER, DEV } from 'esm-env';
import { untrack } from 'svelte';
import { on } from 'svelte/events';
import { createSubscriber } from 'svelte/reactivity';

export interface PersistedStateOptions {
	storage?: 'local' | 'session';
}

export class PersistedState<T> {
	#key: string;
	#initial: T;
	#area: 'localStorage' | 'sessionStorage';
	#value: T;
	/** `undefined` until the first read, so a stored `null` (an empty key) still counts as seen. */
	#seen: string | null | undefined;
	/** Wakes readers after an own write, including one that never reached storage. */
	#version = $state.raw(0);
	/** Set while `#value` holds a write storage refused, so any later write to the key replaces it. */
	#unsaved = false;

	#subscribe = createSubscriber((update) =>
		on(window, 'storage', (event) => {
			if (event.storageArea !== this.#storage()) return;
			if (event.key !== null && event.key !== this.#key) return;
			/**
			 * The write may have stored the very string `#seen` captured at the failure, which the getter
			 * cannot tell apart from no write at all.
			 */
			if (this.#unsaved) {
				this.#unsaved = false;
				this.#seen = undefined;
			}
			update();
		})
	);

	constructor(key: string, initial: T, options: PersistedStateOptions = {}) {
		this.#key = key;
		this.#initial = initial;
		this.#area = `${options.storage ?? 'local'}Storage`;
		this.#value = initial;
	}

	#storage(): Storage | undefined {
		try {
			return window[this.#area];
		} catch {
			return undefined;
		}
	}

	/** `undefined` when storage refuses the read. */
	#read(): string | null | undefined {
		try {
			return this.#storage()?.getItem(this.#key) ?? null;
		} catch {
			return undefined;
		}
	}

	#fail(error: unknown) {
		if (DEV) console.warn(`PersistedState could not write "${this.#key}"`, error);
		/** Marks what storage still holds as seen, so the next read keeps the in-memory value. */
		this.#seen = this.#read();
		this.#unsaved = true;
	}

	get current(): T {
		void this.#version;
		if (!BROWSER) return this.#value;
		this.#subscribe();

		const raw = this.#read();
		if (raw === undefined || raw === this.#seen) return this.#value;

		this.#seen = raw;
		try {
			this.#value = raw === null ? this.#initial : parse(raw);
		} catch {
			this.#value = this.#initial;
		}
		return this.#value;
	}

	set current(value: T) {
		const raw = stringify(value);
		this.#value = value;
		/** Untracked, so an effect that assigns `current` does not come to depend on its own write and rerun forever. */
		this.#version = untrack(() => this.#version) + 1;
		if (!BROWSER) return;

		const storage = this.#storage();
		if (!storage) {
			this.#fail(new Error(`${this.#area} is unavailable`));
			return;
		}
		try {
			storage.setItem(this.#key, raw);
		} catch (error) {
			this.#fail(error);
			return;
		}
		this.#seen = raw;
		this.#unsaved = false;
		window.dispatchEvent(
			new StorageEvent('storage', { key: this.#key, newValue: raw, storageArea: storage })
		);
	}
}
