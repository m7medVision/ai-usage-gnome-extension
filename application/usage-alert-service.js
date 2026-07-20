/* Application use case for usage alerts. The injected store and notifier keep
 * alert policy independent from both the filesystem and GNOME Shell. */

import { evaluateUsageAlerts } from '../domain/usage-alert-policy.js';

export class UsageAlertService {
    #stateStore;
    #notify;
    #logger;

    constructor({ stateStore, notify, logger }) {
        this.#stateStore = stateStore;
        this.#notify = notify;
        this.#logger = logger;
    }

    process(input) {
        const decision = evaluateUsageAlerts({
            ...input,
            state: this.#stateStore.load(),
        });
        this.#stateStore.save(decision.state);

        for (const alert of decision.alerts) {
            try {
                this.#notify(alert);
            } catch (error) {
                this.#logger(`[ai-usage] could not send usage alert: ${error}`);
            }
        }

        return decision.alerts;
    }
}
