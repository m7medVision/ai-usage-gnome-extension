export function clampPercent(value) {
    return Math.max(0, Math.min(100, value));
}

export function usageLevel(percentUsed, highThreshold, criticalThreshold) {
    if (percentUsed === null || percentUsed === undefined)
        return 'unknown';
    if (percentUsed >= criticalThreshold)
        return 'critical';
    if (percentUsed >= highThreshold)
        return 'high';
    if (percentUsed >= 50)
        return 'medium';
    return 'low';
}

export function worstPercentUsed(accounts, results) {
    let worst = null;
    for (const account of accounts) {
        const result = results[account.id];
        if (!result?.attempted)
            continue;
        for (const entry of result.entries ?? []) {
            if (entry.kind !== 'percent')
                continue;
            const used = clampPercent(entry.percentUsed ?? 100 - (entry.percentRemaining ?? 100));
            worst = worst === null ? used : Math.max(worst, used);
        }
    }
    return worst;
}

export function pickPrimaryEntry(result) {
    if (!result)
        return { state: 'no-data' };
    if (!result.attempted)
        return { state: 'not-configured' };
    if (!result.entries?.length) {
        return result.errors?.length
            ? { state: 'error', message: result.errors[0] }
            : { state: 'empty' };
    }

    const percentages = result.entries.filter(entry => entry.kind === 'percent');
    if (!percentages.length)
        return { state: 'other', entry: result.entries[0] };

    const fiveHour = percentages.find(entry =>
        /5h/i.test(entry.label ?? '') || /5h/i.test(entry.name ?? ''));
    return { state: 'percent', entry: fiveHour ?? percentages[0] };
}
