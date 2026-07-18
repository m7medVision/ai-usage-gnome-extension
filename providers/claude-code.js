/* Claude Code provider
 *
 * Auth: OAuth access token auto-detected from
 * ~/.claude/.credentials.json. This extension does not implement OAuth
 * refresh — when `credentials.autoDetect` is set, `fetch()` re-reads the
 * credentials file live on every call, so it always sees whatever token
 * the Claude Code CLI itself most recently refreshed. Falls back to a
 * manually-pasted `credentials.oauthToken` when the local file isn't
 * present (autoDetect === false).
 *
 * Endpoint: POST https://api.anthropic.com/v1/messages
 * Claude Code has no dedicated free usage-percentage endpoint — verified
 * against this account: the free `/v1/messages/count_tokens` call and
 * 400-rejected requests both come back with NO `anthropic-ratelimit-*`
 * headers at all. Those headers only appear on a real, successful
 * inference call, so this provider necessarily spends a small amount of
 * real quota (`max_tokens: 1`, a one-word prompt) on every poll to read
 * them — there is no cheaper way to check Claude Code's usage via the API.
 *
 * Confirmed live response header shape (flat headers, NOT a JSON blob):
 *   anthropic-ratelimit-unified-status: allowed
 *   anthropic-ratelimit-unified-5h-status: allowed
 *   anthropic-ratelimit-unified-5h-utilization: 0.2      (fraction 0-1)
 *   anthropic-ratelimit-unified-5h-reset: 1783944600      (epoch seconds)
 *   anthropic-ratelimit-unified-7d-status: allowed
 *   anthropic-ratelimit-unified-7d-utilization: 0.61
 *   anthropic-ratelimit-unified-7d-reset: 1783976400
 * Per-model weekly windows (opus/sonnet) were not present on this
 * account/tier but are parsed generically below in case they appear on
 * other plans.
 */

import Soup from 'gi://Soup?version=3.0';
import GLib from 'gi://GLib';
import { USER_AGENT } from './constants.js';
import { detectClaudeCode } from '../local-detect.js';

const MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
// Version-less alias — resolves server-side to the current Haiku snapshot,
// so this doesn't need updating as new model versions ship.
const PROBE_MODEL = 'claude-haiku-4-5';

const WINDOW_LABELS = {
    '5h': ['Claude Code 5h', '5h:'],
    '7d': ['Claude Code Weekly', 'Weekly:'],
    '7d-opus': ['Claude Code Weekly (Opus)', 'Weekly Opus:'],
    '7d-sonnet': ['Claude Code Weekly (Sonnet)', 'Weekly Sonnet:'],
};

function clampPercent(val) {
    return Math.max(0, Math.min(100, val));
}

export const claudeCodeProvider = {
    id: 'claude-code',
    label: 'Claude Code',

    needsAuth(credentials) {
        return !!(credentials.autoDetect || credentials.oauthToken);
    },

    async fetch(session, credentials) {
        let token = credentials.oauthToken;
        if (credentials.autoDetect) {
            const live = detectClaudeCode();
            if (!live) {
                return { attempted: false, errors: ['Claude Code: ~/.claude/.credentials.json not found'] };
            }
            token = live.credentials.oauthToken;
        }
        if (!token) return { attempted: false };

        try {
            const message = Soup.Message.new('POST', MESSAGES_URL);
            const headers = message.get_request_headers();
            headers.append('Authorization', `Bearer ${token}`);
            headers.append('anthropic-version', ANTHROPIC_VERSION);
            headers.append('anthropic-beta', 'oauth-2025-04-20');
            headers.append('Content-Type', 'application/json');
            headers.append('User-Agent', USER_AGENT);

            const body = JSON.stringify({
                model: PROBE_MODEL,
                max_tokens: 1,
                messages: [{ role: 'user', content: 'hi' }],
            });
            message.set_request_body_from_bytes('application/json',
                new GLib.Bytes(new TextEncoder().encode(body)));

            const result = await new Promise((resolve, reject) => {
                session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null,
                    (s, res) => {
                        try {
                            const bytes = s.send_and_read_finish(res);
                            const respBody = new TextDecoder().decode(
                                bytes?.get_data() ?? new Uint8Array(0));
                            const respHeaders = {};
                            message.get_response_headers().foreach((name, value) => {
                                respHeaders[name.toLowerCase()] = value;
                            });
                            resolve({ status: message.get_status(), body: respBody, headers: respHeaders });
                        } catch (e) { reject(e); }
                    });
            });

            if (result.status !== 200) {
                let errDetail = result.body?.substring(0, 200) || '';
                try { const j = JSON.parse(result.body); errDetail = j.error?.message || errDetail; } catch (_) {}
                return { attempted: true, entries: [], errors: [`Claude Code HTTP ${result.status}: ${errDetail}`] };
            }

            return this._parseHeaders(result.headers);
        } catch (e) {
            return { attempted: true, entries: [], errors: [`Claude Code error: ${e.message || e}`] };
        }
    },

    /* Parse the flat anthropic-ratelimit-unified-<window>-{utilization,reset}
     * headers into percent entries. Generic over whatever <window> keys are
     * present so per-model weekly windows (opus/sonnet) show up on plans
     * that have them, without failing on plans that don't. */
    _parseHeaders(headers) {
        const entries = [];
        const errors = [];

        const windowKeys = new Set();
        for (const name of Object.keys(headers)) {
            const m = /^anthropic-ratelimit-unified-(.+)-utilization$/.exec(name);
            if (m) windowKeys.add(m[1]);
        }

        for (const key of windowKeys) {
            const util = parseFloat(headers[`anthropic-ratelimit-unified-${key}-utilization`]);
            if (Number.isNaN(util)) continue;
            const resetRaw = headers[`anthropic-ratelimit-unified-${key}-reset`];
            const resetTimeIso = resetRaw ? new Date(parseInt(resetRaw, 10) * 1000).toISOString() : null;

            const [name, label] = WINDOW_LABELS[key] || [`Claude Code ${key}`, `${key}:`];
            const usedPct = util <= 1 ? util * 100 : util;
            entries.push({
                kind: 'percent', name, group: 'Claude Code', label,
                percentUsed: usedPct,
                percentRemaining: clampPercent(100 - usedPct),
                resetTimeIso,
            });
        }

        if (entries.length === 0)
            errors.push('Claude Code: no rate-limit headers in response');

        return { attempted: true, entries, errors };
    },
};
