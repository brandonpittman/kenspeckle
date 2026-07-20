import { DEV } from 'esm-env';

export type EventMap = Record<string, unknown[]>;

type EventArgs<EventsT extends EventMap> = {
	[K in keyof EventsT]: { event: K; args: EventsT[K] };
}[keyof EventsT];

export type ActionMeta<
	StatesT extends string,
	EventsT extends EventMap,
	ContextT,
	CurrentT extends StatesT,
	K extends keyof EventsT
> = {
	from: CurrentT;
	event: K;
	args: EventsT[K];
	context: ContextT;
};

export type EnterMeta<
	StatesT extends string,
	EventsT extends EventMap,
	ContextT,
	CurrentT extends StatesT
> = { to: CurrentT; context: ContextT } & (
	| ({ from: StatesT } & EventArgs<EventsT>)
	| { from: null; event: null; args: [] }
);

export type ExitMeta<
	StatesT extends string,
	EventsT extends EventMap,
	ContextT,
	CurrentT extends StatesT
> = { from: CurrentT; to: StatesT; context: ContextT } & EventArgs<EventsT>;

export type Action<
	StatesT extends string,
	EventsT extends EventMap,
	ContextT,
	CurrentT extends StatesT,
	K extends keyof EventsT
> = StatesT | ((meta: ActionMeta<StatesT, EventsT, ContextT, CurrentT, K>) => StatesT | void);

export type StateHandler<
	StatesT extends string,
	EventsT extends EventMap,
	ContextT,
	CurrentT extends StatesT
> = {
	[K in keyof EventsT]?: Action<StatesT, EventsT, ContextT, CurrentT, K>;
} & {
	_enter?: (meta: EnterMeta<StatesT, EventsT, ContextT, CurrentT>) => void;
	_exit?: (meta: ExitMeta<StatesT, EventsT, ContextT, CurrentT>) => void;
};

export type Transition<StatesT extends string, EventsT extends EventMap, ContextT = undefined> = {
	[S in StatesT]: StateHandler<StatesT, EventsT, ContextT, S>;
} & {
	'*'?: StateHandler<StatesT, EventsT, ContextT, StatesT>;
};

export class FiniteStateMachine<
	StatesT extends string,
	EventsT extends EventMap,
	ContextT = undefined
> {
	#current: StatesT = $state()!;
	#context: ContextT = $state()!;
	readonly states: Transition<StatesT, EventsT, ContextT>;

	constructor(
		initial: StatesT,
		states: Transition<StatesT, EventsT, ContextT>,
		...options: undefined extends ContextT ? [] : [{ context: ContextT }]
	) {
		this.#current = initial;
		this.states = states;
		this.#context = (options[0]?.context ?? undefined) as ContextT;
		this.#lifecycle('_enter', initial, {
			from: null,
			to: initial,
			event: null,
			args: [],
			context: this.#context
		});
	}

	send = <K extends keyof EventsT>(event: K, ...args: EventsT[K]): StatesT => {
		const action = this.states[this.#current]?.[event] ?? this.states['*']?.[event];
		if (action === undefined) {
			if (DEV) {
				console.warn(`kenspeckle: unhandled event '${String(event)}' in state '${this.#current}'`);
			}
			return this.#current;
		}
		const target =
			typeof action === 'function'
				? (action as (meta: unknown) => StatesT | void)({
						from: this.#current,
						event,
						args,
						context: this.#context
					})
				: (action as StatesT);
		if (target !== undefined) this.#transition(target, event, args);
		return this.#current;
	};

	#timeouts: { [K in keyof EventsT]?: ReturnType<typeof setTimeout> } = {};

	debounce = <K extends keyof EventsT>(
		event: K,
		wait: number = 500,
		...args: EventsT[K]
	): Promise<StatesT> => {
		clearTimeout(this.#timeouts[event]);
		return new Promise((resolve) => {
			this.#timeouts[event] = setTimeout(() => {
				delete this.#timeouts[event];
				resolve(this.send(event, ...args));
			}, wait);
		});
	};

	#transition(to: StatesT, event: keyof EventsT, args: unknown[]) {
		const from = this.#current;
		this.#lifecycle('_exit', from, { from, to, event, args, context: this.#context });
		this.#current = to;
		this.#lifecycle('_enter', to, { from, to, event, args, context: this.#context });
	}

	#lifecycle(kind: '_enter' | '_exit', state: StatesT, meta: unknown) {
		const fn = this.states[state]?.[kind] ?? this.states['*']?.[kind];
		(fn as ((meta: unknown) => void) | undefined)?.(meta);
	}

	get current(): StatesT {
		return this.#current;
	}

	get context(): ContextT {
		return this.#context;
	}

	set context(next: ContextT) {
		this.#context = next;
	}
}
