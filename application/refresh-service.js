/* RefreshService — composes a SingleFlight (coalesces concurrent refreshes
 * onto one network pass) with a Scheduler (ticks every interval). Splits the
 * old RefreshLoop into two collaborators so each is testable in isolation:
 *   - manual refresh + scheduled tick land on the same SingleFlight;
 *   - errors stop neither the timer (Scheduler) nor future manual refreshes.
 *
 * Interface matches what extension.js needs: start(interval) initial-fetches
 * and starts the timer; refresh() does a one-shot (used by the header
 * button); stop() tears both down with no orphan callbacks. */
import { Scheduler } from './scheduler.js';
import { SingleFlight } from './single-flight.js';

export class RefreshService {
    #scheduler;
    #single;

    constructor({ fetch, schedule, cancel }) {
        this.#single = new SingleFlight(fetch);
        this.#scheduler = new Scheduler({ schedule, cancel });
    }

    /* Run an initial fetch, then tick every intervalMs. Calling start()
     * again (e.g. settings/config changed) cancels the old timer and, if a
     * fetch is still in flight, arms a refire so the new credentials take
     * effect once the in-flight one settles — without launching a duplicate
     * fetch on top of the running one. */
    start(intervalMs) {
        this.#scheduler.start(intervalMs, () => this.#single.run());
        this.#single.requestRefire();
        return this.#single.run();
    }

    /* One-shot refresh — coalesces with an in-flight fetch via SingleFlight. */
    refresh() {
        return this.#single.run();
    }

    stop() {
        this.#single.cancel();
        this.#scheduler.stop();
    }
}