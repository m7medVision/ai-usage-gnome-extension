/* Pure usage-alert policy. It turns successful percentage observations into
 * de-duplicated alert events; persistence and GNOME notification delivery stay
 * outside the domain layer. */

export const ALERT_REARM_DELTA = 5;

export function emptyAlertState() {
    return { version: 1, entries: {} };
}

export function evaluateUsageAlerts({
    accounts = [],
    results = {},
    threshold,
    enabled = true,
    state = emptyAlertState(),
}) {
    const normalizedThreshold = normalizeThreshold(threshold);
    if (!enabled || normalizedThreshold === null)
        return { alerts: [], state: emptyAlertState() };

    const accountIds = new Set(accounts.map(account => account.id));
    const entries = retainedEntries(state.entries, accountIds);
    const alerts = evaluateAccounts(accounts, results, normalizedThreshold, entries);
    return { alerts, state: { version: 1, entries } };
}

function evaluateAccounts(accounts, results, threshold, entries) {
    const alerts = [];
    for (const account of accounts)
        evaluateAccount(account, resultFor(results, account.id), threshold, entries, alerts);
    return alerts;
}

function evaluateAccount(account, result, threshold, entries, alerts) {
    if (!result?.attempted)
        return;

    for (const entry of result.entries ?? []) {
        const observation = alertObservation(account, entry);
        if (!observation)
            continue;
        const next = nextAlertState(entries[observation.key], observation.percentUsed, threshold);
        entries[observation.key] = { accountId: account.id, armed: next.armed, threshold };
        if (next.shouldNotify)
            alerts.push({ ...observation, threshold });
    }
}

function resultFor(results, accountId) {
    return results instanceof Map ? results.get(accountId) : results[accountId];
}

function retainedEntries(entries, accountIds) {
    if (!entries || typeof entries !== 'object' || Array.isArray(entries))
        return {};

    return Object.fromEntries(Object.entries(entries).filter(([, entry]) =>
        entry && accountIds.has(entry.accountId)));
}

function alertObservation(account, entry) {
    if (entry?.kind !== 'percent' || !validName(entry.name))
        return null;

    const percentUsed = percentUsedFor(entry);
    if (percentUsed === null)
        return null;

    return {
        key: JSON.stringify([account.id, entry.name]),
        accountId: account.id,
        accountLabel: account.label,
        entryLabel: entry.label ?? entry.name,
        entryName: entry.name,
        percentUsed,
    };
}

function nextAlertState(previous, percentUsed, threshold) {
    if (previous?.threshold !== threshold) {
        const shouldNotify = percentUsed >= threshold;
        return { armed: !shouldNotify, shouldNotify };
    }

    if (percentUsed < threshold - ALERT_REARM_DELTA)
        return { armed: true, shouldNotify: false };

    if (percentUsed >= threshold && previous.armed)
        return { armed: false, shouldNotify: true };

    return { armed: previous.armed, shouldNotify: false };
}

function percentUsedFor(entry) {
    const value = Number.isFinite(entry.percentUsed)
        ? entry.percentUsed
        : Number.isFinite(entry.percentRemaining)
            ? 100 - entry.percentRemaining
            : null;
    return value === null ? null : Math.max(0, Math.min(100, value));
}

function normalizeThreshold(value) {
    if (!Number.isInteger(value) || value < 1 || value > 100)
        return null;
    return value;
}

function validName(value) {
    return typeof value === 'string' && value.length > 0;
}
