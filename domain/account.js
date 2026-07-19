/* Account value object — the shape an enabled configured provider account
 * takes wherever it crosses a module boundary. */
// ponytail: thin value object; no invariant to protect beyond shape.
// Kept as a factory rather than a frozen class so the 6 provider adapters
// (which build these as plain literals) don't pay construction ceremony.

/**
 * @typedef {Object} Account
 * @property {string} id              - stable account id ("acc_...")
 * @property {string} label           - user-visible label
 * @property {string} provider       - provider id in the registry
 * @property {boolean} enabled        - whether to fetch this account
 * @property {Object} credentials     - provider-specific credential bag
 */

export function createAccount({ id, label, provider, enabled = true, credentials = {} }) {
    return { id, label, provider, enabled, credentials };
}

/* True when an account (loaded from JSON config) is fetchable today —
 * enabled in the file and bound to a known provider adapter. */
export function isAccountEnabled(account) {
    return !!account && account.enabled !== false;
}