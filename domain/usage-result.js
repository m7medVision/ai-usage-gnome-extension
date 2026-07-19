/* UsageResult value object — the contract every provider's `fetch()`
 * returns. `attempted` distinguishes "no credentials, did not try" from
 * "tried and got nothing back"; `entries` and `errors` together drive the
 * renderer and overview selection logic. */
// ponytail: thin value object; no invariant to protect beyond shape.

/**
 * @typedef {Object} UsageResult
 * @property {boolean} attempted   - true if fetch actually ran
 * @property {Array}   entries     - UsageEntry[] (may be empty on error)
 * @property {Array}   errors      - string[] of human-readable failure reasons
 */

export function createResult({ attempted, entries = [], errors = [] }) {
    return { attempted, entries, errors };
}

/* Sentinel result used when an account had no credentials so the provider
 * never called the network. The overview renders these as
 * "Not configured" rather than "Error". */
export function notAttempted() {
    return { attempted: false, entries: [], errors: [] };
}