/* AccountRepository — the single owner of `config.load()` for the shell
 * process. Surfaces a ConfigError as `lastError` (rendered in the panel)
 * instead of letting every caller either swallow it as "no accounts" or
 * propagate a throw that GJS would log as an unhandled rejection. */
import * as config from '../config.js';
import { isAccountEnabled } from '../domain/account.js';

export class AccountRepository {
    #registry;
    lastError = null;

    constructor(registry) {
        this.#registry = registry;
    }

    /* Returns [{ account, provider }] for enabled accounts with a known
     * adapter in the registry. On a corrupt config, returns [] and sets
     * `lastError` so the indicator can render the reason instead of looking
     * like an empty-first-run. */
    loadEnabled() {
        let cfg;
        try {
            cfg = config.load();
        } catch (e) {
            this.lastError = e.message || String(e);
            return [];
        }
        this.lastError = null;

        const out = [];
        for (const acc of cfg.accounts) {
            if (!isAccountEnabled(acc))
                continue;
            const provider = this.#registry[acc.provider]?.adapter;
            if (!provider)
                continue;
            out.push({ account: acc, provider });
        }
        return out;
    }
}