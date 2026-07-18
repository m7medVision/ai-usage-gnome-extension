/* local-detect.js — read-only scanner for local CLI credential stores.
 *
 * Used by prefs.js's "Auto-detect accounts" button to find credentials
 * already sitting on disk from other CLI tools (Claude Code, opencode),
 * so the user doesn't have to copy/paste tokens by hand. Never writes
 * anything.
 */

import GLib from 'gi://GLib';

function readJsonFile(path) {
    try {
        const [ok, contents] = GLib.file_get_contents(path);
        if (!ok || !contents) return null;
        const text = new TextDecoder().decode(contents);
        return JSON.parse(text);
    } catch (e) {
        return null;
    }
}

/* Claude Code CLI: ~/.claude/.credentials.json */
export function detectClaudeCode() {
    const path = GLib.build_filenamev([GLib.get_home_dir(), '.claude', '.credentials.json']);
    const data = readJsonFile(path);
    const oauth = data?.claudeAiOauth;
    if (!oauth?.accessToken) return null;

    return {
        provider: 'claude-code',
        source: 'claude-code-cli',
        label: 'Claude Code',
        credentials: {
            oauthToken: oauth.accessToken,
            oauthRefresh: oauth.refreshToken || '',
            oauthExpiry: oauth.expiresAt ? Math.floor(oauth.expiresAt / 1000) : 0,
            subscriptionType: oauth.subscriptionType || '',
            autoDetect: true,
        },
        // No email/account-id is available in this file — the raw access
        // token is the only identity signal we have for dedup purposes.
        identityKey: oauth.accessToken,
    };
}

/* opencode CLI: ~/.local/share/opencode/auth.json
 *
 * This file is keyed by service id and holds credentials for several
 * tools at once. Only entries whose credential shape matches an existing
 * provider in this extension are imported:
 *   - "zai-coding-plan" (api key)   -> zai provider's `apiKey`
 *   - "openai" (oauth access/refresh) -> openai provider's oauth fields
 * The "opencode-go" entry in this file is a *different* internal API key
 * (not the {workspaceId, authCookie} cookie scheme the opencode-go
 * provider needs to scrape the hosted dashboard), so it is intentionally
 * skipped rather than mismapped.
 */
export function detectOpencodeAuth() {
    const path = GLib.build_filenamev([
        GLib.get_home_dir(), '.local', 'share', 'opencode', 'auth.json']);
    const data = readJsonFile(path);
    if (!data) return [];

    const results = [];

    const zai = data['zai-coding-plan'];
    if (zai?.type === 'api' && zai.key) {
        results.push({
            provider: 'zai',
            source: 'opencode-auth',
            label: 'Z.AI (via opencode)',
            credentials: {
                apiKey: zai.key, oauthToken: '', oauthRefresh: '', oauthExpiry: 0, endpoint: 'intl',
            },
            identityKey: zai.key,
        });
    }

    const openai = data['openai'];
    if (openai?.type === 'oauth' && openai.access) {
        results.push({
            provider: 'openai',
            source: 'opencode-auth',
            label: 'OpenAI (via opencode)',
            credentials: {
                oauthToken: openai.access,
                oauthRefresh: openai.refresh || '',
                oauthExpiry: openai.expires ? Math.floor(openai.expires / 1000) : 0,
                accountId: openai.accountId || '',
            },
            // Prefer accountId when present: it survives token rotation,
            // unlike comparing the access token string itself.
            identityKey: openai.accountId || openai.access,
        });
    }

    return results;
}

/* "pi agent" (~/.pi/agent/auth.json) is a real local tool but out of
 * scope for now — add a detectPiAgent() here later if it gets picked up. */

/* Aggregate entry point used by prefs.js. */
export function scanLocalAuthSources() {
    const found = [];
    const cc = detectClaudeCode();
    if (cc) found.push(cc);
    found.push(...detectOpencodeAuth());
    return found;
}
