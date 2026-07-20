import { evaluateUsageAlerts } from '../../domain/usage-alert-policy.js';

function assertEqual(actual, expected, message) {
    if (actual !== expected)
        throw new Error(`${message}: expected ${expected}, got ${actual}`);
}

const account = { id: 'acc_work', label: 'Work' };

function result(percentUsed, name = 'Claude 5h') {
    return new Map([['acc_work', {
        attempted: true,
        entries: [{ kind: 'percent', name, label: '5h:', percentUsed }],
    }]]);
}

function evaluate({ percentUsed, state, threshold = 90, enabled = true, name }) {
    return evaluateUsageAlerts({
        accounts: [account],
        results: result(percentUsed, name),
        threshold,
        enabled,
        state,
    });
}

function testAlertsOnInitialObservationAtThreshold() {
    const decision = evaluate({ percentUsed: 90 });

    assertEqual(decision.alerts.length, 1, 'initial threshold alert count');
    assertEqual(decision.alerts[0].accountLabel, 'Work', 'alert account label');
    assertEqual(decision.alerts[0].entryLabel, '5h:', 'alert quota window label');
}

function testDoesNotRepeatAboveThreshold() {
    const first = evaluate({ percentUsed: 90 });
    const second = evaluate({ percentUsed: 96, state: first.state });

    assertEqual(second.alerts.length, 0, 'continuous high usage must not repeat alerts');
}

function testRearmsBelowHysteresisBoundary() {
    const first = evaluate({ percentUsed: 90 });
    const recovered = evaluate({ percentUsed: 84, state: first.state });
    const second = evaluate({ percentUsed: 90, state: recovered.state });

    assertEqual(second.alerts.length, 1, 'recovered quota must alert on a new crossing');
}

function testAccountsAndQuotaWindowsHaveIndependentState() {
    const first = evaluateUsageAlerts({
        accounts: [account, { id: 'acc_personal', label: 'Personal' }],
        results: new Map([
            ['acc_work', {
                attempted: true,
                entries: [{ kind: 'percent', name: 'Claude 5h', label: '5h:', percentUsed: 90 }],
            }],
            ['acc_personal', {
                attempted: true,
                entries: [{ kind: 'percent', name: 'Claude 5h', label: '5h:', percentUsed: 90 }],
            }],
        ]),
        threshold: 90,
    });
    const second = evaluate({ percentUsed: 90, state: first.state, name: 'Claude Weekly' });

    assertEqual(first.alerts.length, 2, 'separate accounts must alert independently');
    assertEqual(second.alerts.length, 1, 'a second quota window must alert independently');
}

function testChangedThresholdCreatesNewCrossing() {
    const first = evaluate({ percentUsed: 90 });
    const changed = evaluate({ percentUsed: 95, threshold: 95, state: first.state });

    assertEqual(changed.alerts.length, 1, 'a newly reached changed threshold must alert');
}

function testIgnoresFailedAndNonPercentResults() {
    const failed = evaluateUsageAlerts({
        accounts: [account],
        results: new Map([['acc_work', { attempted: true, entries: [], errors: ['offline'] }]]),
        threshold: 90,
    });
    const balance = evaluateUsageAlerts({
        accounts: [account],
        results: new Map([['acc_work', {
            attempted: true,
            entries: [{ kind: 'value', name: 'Balance', value: '$1' }],
        }]]),
        threshold: 90,
    });

    assertEqual(failed.alerts.length, 0, 'fetch failure must not alert');
    assertEqual(balance.alerts.length, 0, 'non-percent entry must not alert');
}

function testDisabledAlertsClearDedupeState() {
    const first = evaluate({ percentUsed: 90 });
    const disabled = evaluate({ percentUsed: 90, state: first.state, enabled: false });
    const enabled = evaluate({ percentUsed: 90, state: disabled.state });

    assertEqual(enabled.alerts.length, 1, 're-enabled alerts must notify current high usage once');
}

testAlertsOnInitialObservationAtThreshold();
testDoesNotRepeatAboveThreshold();
testRearmsBelowHysteresisBoundary();
testAccountsAndQuotaWindowsHaveIndependentState();
testChangedThresholdCreatesNewCrossing();
testIgnoresFailedAndNonPercentResults();
testDisabledAlertsClearDedupeState();
