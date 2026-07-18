# README — design

**Date:** 2026-07-18
**Status:** Approved
**Parent spec:** [2026-07-18-kenspeckle-design.md](./2026-07-18-kenspeckle-design.md)

## Goal

Replace the sv-create scaffold README with the library's real README. The name story is the opening hook: *kenspeckle* means "easily recognized, familiar at sight" — which is the library's thesis (one naming convention, names you recognize at sight). Written as the final published-library README, with a pre-release status line; examples come from the parent spec and become the contract to build against.

## Structure (name → proof → practice)

1. **Header** — dictionary-entry open: `ken·speck·le` /ˈkɛnspɛkl/ *adj.* (Scots, from Old Norse *kennispeki*, "quick at recognizing") — easily recognized; familiar at sight. One-line thesis: Svelte utilities you recognize at sight; one naming convention, no `use` prefix, attachments first-class. Pre-release status line.
2. **The sentence test** — the three examples from the parent spec (✓ finite state machine → class; ✗ element size → factory; ✗✗ is idle → `idle()`), the two rules (classes only when "new X" is speakable and driven by methods; everything else camelCase, no `use`/`is` prefixes). Closes tying back to the name: the word is the spec.
3. **Attachments, curried** — `clickOutside` dual-form snippet + `elementSize` readable-box snippet, verbatim shape from parent spec.
4. **Install / usage** — `npm install kenspeckle`, minimal import example, peer dep `svelte >= 5.40`.
5. **What's inside** — trimmed disposition table: kenspeckle name, form, origin (runed / svelte-put / new). Drops runed-internal detail columns.
6. **Provenance** — curated from runed + svelte-put, why new library not fork (three naming regimes, forced classes, no attachments layer), MIT attribution.

## Tone

Dry wit, terse. Dictionary conceit carried lightly — the headword block only; body is a normal README.

## Out of scope

Docs-site content, API reference detail, CONTRIBUTING, badges beyond a status note.

## Unresolved questions

None.
