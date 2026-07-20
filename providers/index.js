/* Provider Strategy registry.
 *
 * Each adapter is self-describing: it exposes its registry id, a human name
 * (used in the selector, overview, and the Preferences "Add Account" dropdown), a
 * logo file, optional OAuth config, and a `defaultCredentials()` factory that
 * owns the shape of its credential bag — so adding a credential field
 * touches only the provider, not the registry.
 *
 * Adding a provider today = author a new provider module + add one line
 * here. Do not branch on provider id in callers; the strategy table is the
 * point. */
import { claudeCodeProvider } from './claude-code.js';
import { deepseekProvider } from './deepseek.js';
import { opencodeGoProvider } from './opencode-go.js';
import { openaiProvider } from './openai.js';
import { zaiProvider } from './zai.js';

export const PROVIDERS = {
    zai: zaiProvider,
    'opencode-go': opencodeGoProvider,
    openai: openaiProvider,
    deepseek: deepseekProvider,
    'claude-code': claudeCodeProvider,
};

/* Fresh credential bag for a provider. Each adapter owns the shape so the
 * defaults cannot drift out of sync with what `fetch()` reads. */
export function createDefaultCredentials(providerId) {
    return PROVIDERS[providerId]?.defaultCredentials?.() ?? {};
}
