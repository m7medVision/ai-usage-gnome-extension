import { pickPrimaryEntry, usageLevel, worstPercentUsed } from '../domain/usage.js';
import { currentPeakStatus } from '../domain/peak.js';
import { SingleFlight } from '../application/single-flight.js';
import { Scheduler } from '../application/scheduler.js';
import { RefreshService } from '../application/refresh-service.js';
import { PROVIDERS, createDefaultCredentials } from '../providers/index.js';
import { EntryKind, isPercentEntry } from '../domain/entry-kind.js';
import { createEntry } from '../domain/usage-entry.js';
import { createResult, notAttempted } from '../domain/usage-result.js';
import { createAccount, isAccountEnabled } from '../domain/account.js';
import { parseResponseHeaders } from '../providers/claude-code.js';
import { overviewRightText } from '../ui/overview-text.js';

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
    assertEqual(status.msToChange, null, 'empty peak countdown is null, not 0');
}

function testOvernightPeakWindowWrapsMidnight() {
    // Arrange
    const now = new Date('2026-07-19T23:00:00Z');

    // Act
    const status = currentPeakStatus(now, [[22, 2]]);

    // Assert
    assertEqual(status.inPeak, true, 'overnight peak status');
}

async function testSingleFlightCoalescesConcurrentCalls() {
    // Arrange
    let fetches = 0;
    let release;
    const blocked = new Promise(resolve => { release = resolve; });
    const single = new SingleFlight(async () => { fetches += 1; await blocked; });

    // Act
    const first = single.run();
    const second = single.run();
    assertEqual(first, second, 'concurrent runs share the in-flight promise');
    release();
    await first;

    // Assert
    assertEqual(fetches, 1, 'concurrent run count');
}

async function testSingleFlightRefiresOnlyWhenRequested() {
    // Arrange
    let fetches = 0;
    const single = new SingleFlight(async () => { fetches += 1; });

    // Act — a plain run() does not arm a refire
    await single.run();
    assertEqual(fetches, 1, 'single fetch with no refire');

    // Arrange — one in-flight, requestRefire arms one extra
    let release;
    const blocked = new Promise(resolve => { release = resolve; });
    let attempts = 0;
    const single2 = new SingleFlight(async () => { attempts += 1; await blocked; });
    const pending = single2.run();
    single2.requestRefire();

    // Act
    release();
    await pending;
    await Promise.resolve();

    // Assert — the refire target started and finished
    assertEqual(attempts, 2, 'requestRefire arms exactly one extra run');
}

async function testSingleFlightFailureDoesNotBlockNextRun() {
    // Arrange
    const single = new SingleFlight(async () => { throw new Error('boom'); });

    // Act + assert — failed run resolves (rejection absorbed) so a second run works
    await single.run();
    let threw = false;
    try { await single.run(); } catch (_) { threw = true; }
    if (threw)
        throw new Error('a failed run must not surface rejection to the next caller');
}

async function testSingleFlightStopsRefiringAfterCancel() {
    // Arrange
    let attempts = 0;
    let release;
    const blocked = new Promise(resolve => { release = resolve; });
    const single = new SingleFlight(async () => { attempts += 1; });

    // Act — arm a refire, then cancel before settle
    single.run();
    single.requestRefire();
    single.cancel();
    release();
    await Promise.resolve();

    // Assert
    assertEqual(attempts, 1, 'cancel drops the armed refire');
}

async function testSchedulerReschedulesAfterFailingCallback() {
    // Arrange
    let fired = 0;
    let timerCallback = null;
    let usedDelayMs = null;
    const scheduler = new Scheduler({
        schedule: (delayMs, callback) => {
            usedDelayMs = delayMs;
            timerCallback = callback;
            return 1;
        },
        cancel: () => {},
    });
    scheduler.start(30_000, async () => {
        fired += 1;
        if (fired === 1)
            throw new Error('boom');
    });

    // Act
    await timerCallback();
    await timerCallback();

    // Assert
    assertEqual(usedDelayMs, 30_000, 'scheduler reuses the same delay');
    assertEqual(fired, 2, 'scheduler keeps ticking after a failure');
}

async function testSchedulerStopInvalidatesStagedCallback() {
    // Arrange
    let fired = 0;
    let timerCallback = null;
    let cancelled = 0;
    const scheduler = new Scheduler({
        schedule: (_delayMs, callback) => {
            timerCallback = callback;
            return 7;
        },
        cancel: id => { cancelled = id; },
    });
    scheduler.start(30_000, async () => { fired += 1; });

    // Act
    scheduler.stop();
    await timerCallback();

    // Assert
    assertEqual(cancelled, 7, 'stop cancels the staged timer');
    assertEqual(fired, 0, 'staged callback does not run after stop');
}

async function testRefreshServiceStartRunsInitialAndScheduledFetches() {
    // Arrange
    let fetches = 0;
    let timerCallback = null;
    const service = new RefreshService({
        fetch: async () => { fetches += 1; },
        schedule: (_delayMs, callback) => {
            timerCallback = callback;
            return 1;
        },
        cancel: () => {},
    });

    // Act
    await service.start(30_000);
    await timerCallback();
    service.stop();

    // Assert
    assertEqual(fetches, 2, 'initial fetch + first scheduled tick');
}

async function testRefreshServiceStopPreventsFurtherFetches() {
    // Arrange
    let fetches = 0;
    let timerCallback = null;
    const service = new RefreshService({
        fetch: async () => { fetches += 1; },
        schedule: (_delayMs, callback) => {
            timerCallback = callback;
            return 1;
        },
        cancel: () => {},
    });
    await service.start(30_000);

    // Act
    service.stop();
    if (timerCallback)
        await timerCallback();
    await service.refresh();

    // Assert
    // The stopped service still runs one manual refresh (SingleFlight allows it),
    // but the staged scheduled callback must NOT fire — cancelled by stop().
    assertEqual(fetches, 2, 'no further scheduled fetch after stop; manual refresh allowed');
}

function testClaudeParserKeepsUsageWithInvalidReset() {
    // Arrange
    const headers = {
        'anthropic-ratelimit-unified-5h-utilization': '0.2',
        'anthropic-ratelimit-unified-5h-reset': 'invalid',
    };

    // Act
    const result = parseResponseHeaders(headers);

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

function testEveryProviderAdapterOwnsDefaultCredentials() {
    // Arrange — the 5 supported providers
    const ids = Object.keys(PROVIDERS);

    // Act + assert
    assertEqual(ids.length, 5, 'provider count');
    for (const id of ids) {
        const first = createDefaultCredentials(id);
        const second = createDefaultCredentials(id);
        if (!first || typeof first !== 'object')
            throw new Error(`${id}: defaultCredentials must return an object`);
        // Mutate one — must not bleed into the next call ( Stanton fresh state per call)
        for (const key of Object.keys(first))
            first[key] = '__mutated__';
        const fresh = createDefaultCredentials(id);
        for (const key of Object.keys(fresh))
            if (fresh[key] === '__mutated__')
                throw new Error(`${id}: defaultCredentials reused state for ${key}`);
        if (!second || first === second)
            throw new Error(`${id}: defaultCredentials returned same instance`);
    }
}

testPanelRiskAlwaysUsesConsumedQuota();
testOverviewPrefersFiveHourLimit();
testEmptyPeakWindowsAreStable();
testOvernightPeakWindowWrapsMidnight();
await testSingleFlightCoalescesConcurrentCalls();
await testSingleFlightRefiresOnlyWhenRequested();
await testSingleFlightFailureDoesNotBlockNextRun();
await testSingleFlightStopsRefiringAfterCancel();
await testSchedulerReschedulesAfterFailingCallback();
await testSchedulerStopInvalidatesStagedCallback();
await testRefreshServiceStartRunsInitialAndScheduledFetches();
await testRefreshServiceStopPreventsFurtherFetches();
testProviderRegistryOwnsFreshCredentialDefaults();
testEveryProviderAdapterOwnsDefaultCredentials();
testClaudeParserKeepsUsageWithInvalidReset();

function testEntryKindIsPercentSelectorsPercentEntriesOnly() {
    // Arrange + act + assert
    assertEqual(isPercentEntry({ kind: EntryKind.Percent }), true, 'percent kind selector');
    assertEqual(isPercentEntry({ kind: EntryKind.BarChart }), false, 'non-percent kind selector');
    assertEqual(isPercentEntry(null), false, 'null entry selector');
}

function testEntryFactoryRejectsUnknownKind() {
    // Arrange + act + assert
    let threw = false;
    try { createEntry('nonsense', {}); } catch (_) { threw = true; }
    if (!threw)
        throw new Error('createEntry must reject unknown kind');
}

function testValueObjectsCarryShapeConstraints() {
    // Arrange + act
    const account = createAccount({ id: 'acc_x', label: 'L', provider: 'zai' });
    const result = createResult({ attempted: true, entries: [], errors: ['e'] });
    const notrun = notAttempted();

    // Assert
    assertEqual(account.enabled, true, 'default account enabled');
    assertEqual(isAccountEnabled(account), true, 'enabled account selector');
    assertEqual(isAccountEnabled({ enabled: false }), false, 'disabled account selector');
    assertEqual(result.errors.length, 1, 'result passes errors through');
    assertEqual(notrun.attempted, false, 'notAttempted sentinel');
}

testEntryKindIsPercentSelectorsPercentEntriesOnly();
testEntryFactoryRejectsUnknownKind();
testValueObjectsCarryShapeConstraints();

function testOverviewRightTextCoversEveryState() {
    // Arrange
    const percent5h = { state: 'percent', entry: { label: '5h:', percentUsed: 17, percentRemaining: 83 } };
    const percentNoLabel = { state: 'percent', entry: { percentUsed: 50 } };
    const other = { state: 'other', entry: { value: '$5.00' } };
    const otherFallback = { state: 'other', entry: { label: 'Balance:' } };

    // Act + assert — used mode (default)
    assertEqual(overviewRightText(percent5h, 'used'), '5h · 17% used',
        'overview right text for percent in used mode');
    assertEqual(overviewRightText(percentNoLabel, 'used'), '50% used',
        'overview right text with no label');
    assertEqual(overviewRightText(percent5h, 'remaining'), '5h · 83% left',
        'overview right text in remaining mode');
    assertEqual(overviewRightText(other, 'used'), '$5.00', 'overview other value');
    assertEqual(overviewRightText(otherFallback, 'used'), 'Balance:', 'overview other fallback to label');
    assertEqual(overviewRightText({ state: 'not-configured' }, 'used'), 'Not configured',
        'overview not-configured state');
    assertEqual(overviewRightText({ state: 'no-data' }, 'used'), 'No data yet',
        'overview no-data state');
    assertEqual(overviewRightText({ state: 'empty' }, 'used'), 'No usage data',
        'overview empty state');
    assertEqual(overviewRightText({ state: 'error', message: 'upstream is down' }, 'used'), 'Error',
        'overview error state');
}

testOverviewRightTextCoversEveryState();
