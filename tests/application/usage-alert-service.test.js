import { UsageAlertService } from '../../application/usage-alert-service.js';
import { emptyAlertState } from '../../domain/usage-alert-policy.js';

function assertEqual(actual, expected, message) {
    if (actual !== expected)
        throw new Error(`${message}: expected ${expected}, got ${actual}`);
}

function testServicePersistsDecisionsAndNotifiesOnlyOnce() {
    let state = emptyAlertState();
    let saves = 0;
    const notifications = [];
    const service = new UsageAlertService({
        stateStore: {
            load: () => state,
            save: nextState => { state = nextState; saves += 1; return true; },
        },
        notify: alert => notifications.push(alert),
        logger: () => {},
    });
    const input = {
        accounts: [{ id: 'acc_work', label: 'Work' }],
        results: new Map([['acc_work', {
            attempted: true,
            entries: [{ kind: 'percent', name: 'Claude 5h', label: '5h:', percentUsed: 91 }],
        }]]),
        enabled: true,
        threshold: 90,
    };

    service.process(input);
    service.process(input);

    assertEqual(notifications.length, 1, 'service must deliver one alert per crossing');
    assertEqual(saves, 2, 'service must persist each evaluated state');
}

testServicePersistsDecisionsAndNotifiesOnlyOnce();
