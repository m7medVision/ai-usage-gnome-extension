import { pickPrimaryEntry, usageLevel, worstPercentUsed } from '../usage.js';
import { RefreshLoop } from '../refresh-loop.js';
import { currentPeakStatus } from '../providers/peak.js';
import { PROVIDERS, createDefaultCredentials } from '../providers/index.js';

function assertEqual(actual, expected, message) {
    if (actual !== expected)
        throw new Error(`${message}: expected ${expected}, got ${actual}`);
}

function assertTrue(value, message) {
    if (!value)
        throw new Error(message);
}

function testPanelRiskAlwaysUsesConsumedQuota() {
    // Arrange
    const accounts = [{ id: 'safe' }, { id: 'critical' }];
    const results = {
        safe: { attempted: true, entries: [{ kind: 'percent', percentRemaining: 90 }] },
        critical: { attempted: true, entries: [{ kind: 'percent', percentRemaining: 10 }] },
    };

    // Act
    const percentUsed = worstPercentUsed(accounts, results);
    const level = usageLevel(percentUsed, 75, 90);

    // Assert
    assertEqual(level, 'critical', 'panel severity must not invert in remaining mode');
}

function testOverviewPrefersFiveHourLimit() {
    // Arrange
    const result = {
        attempted: true,
        entries: [
            { kind: 'percent', label: 'Weekly:', percentUsed: 30 },
            { kind: 'percent', label: '5h:', percentUsed: 10 },
        ],
    };

    // Act
    const picked = pickPrimaryEntry(result);

    // Assert
    assertEqual(picked.entry.label, '5h:', 'overview primary limit');
}

function testEmptyPeakWindowsAreStable() {
    // Arrange
    const now = new Date('2026-07-19T12:00:00Z');

    // Act
    const status = currentPeakStatus(now, []);

    // Assert
    assertEqual(status.msToChange, 0, 'empty peak countdown');
}

function testOvernightPeakWindowWrapsMidnight() {
    // Arrange
    const now = new Date('2026-07-19T23:00:00Z');

    // Act
    const status = currentPeakStatus(now, [[22, 2]]);

    // Assert
    assertEqual(status.inPeak, true, 'overnight peak status');
}

async function testRefreshLoopFetchesOncePerTick() {
    // Arrange
    let fetches = 0;
    let scheduledCallback = null;
    const loop = new RefreshLoop({
        fetch: async () => { fetches += 1; },
        schedule: (_delayMs, callback) => {
            scheduledCallback = callback;
            return 1;
        },
        cancel: () => {},
    });

    // Act
    await loop.start(30_000);
    await scheduledCallback();

    // Assert
    assertEqual(fetches, 2, 'initial and scheduled fetch count');
}

async function testConcurrentRefreshesUseOneFetch() {
    // Arrange
    let fetches = 0;
    let release;
    const blocked = new Promise(resolve => { release = resolve; });
    const loop = new RefreshLoop({
        fetch: async () => { fetches += 1; await blocked; },
        schedule: () => 1,
        cancel: () => {},
    });

    // Act
    const first = loop.start(30_000);
    const second = loop.refresh();
    release();
    await Promise.all([first, second]);

    // Assert
    assertEqual(fetches, 1, 'concurrent refresh count');
}

async function testRefreshLoopReschedulesAfterFailure() {
    // Arrange
    let shouldFail = false;
    let scheduledCallback = null;
    let schedules = 0;
    const loop = new RefreshLoop({
        fetch: async () => {
            if (shouldFail)
                throw new Error('temporary failure');
        },
        schedule: (_delayMs, callback) => {
            schedules += 1;
            scheduledCallback = callback;
            return schedules;
        },
        cancel: () => {},
    });
    await loop.start(30_000);

    // Act
    shouldFail = true;
    try { await scheduledCallback(); } catch (_) {}

    // Assert
    assertEqual(schedules, 2, 'timer count after a failed refresh');
}

function testClaudeParserKeepsUsageWithInvalidReset() {
    // Arrange
    const headers = {
        'anthropic-ratelimit-unified-5h-utilization': '0.2',
        'anthropic-ratelimit-unified-5h-reset': 'invalid',
    };

    // Act
    const result = PROVIDERS['claude-code'].adapter._parseHeaders(headers);

    // Assert
    assertTrue(result.entries.length === 1 && result.entries[0].resetTimeIso === null,
        'invalid reset must not discard valid utilization');
}

function testProviderRegistryOwnsFreshCredentialDefaults() {
    // Arrange
    const providerId = 'zai';

    // Act
    const first = createDefaultCredentials(providerId);
    const second = createDefaultCredentials(providerId);
    first.apiKey = 'changed';

    // Assert
    assertEqual(PROVIDERS[providerId].name, 'Z.AI (Zhipu)', 'provider metadata');
    assertEqual(second.apiKey, '', 'provider defaults must not share mutable state');
}

testPanelRiskAlwaysUsesConsumedQuota();
testOverviewPrefersFiveHourLimit();
testEmptyPeakWindowsAreStable();
testOvernightPeakWindowWrapsMidnight();
await testRefreshLoopFetchesOncePerTick();
await testConcurrentRefreshesUseOneFetch();
await testRefreshLoopReschedulesAfterFailure();
testProviderRegistryOwnsFreshCredentialDefaults();
testClaudeParserKeepsUsageWithInvalidReset();
