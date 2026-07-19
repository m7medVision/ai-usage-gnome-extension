/* Scheduler — owns one GLib timer that ticks `callback` every `delayMs`. A
 * generation token invalidates staged callbacks after `stop()` so a callback
 * racing with teardown cannot re-arm or run against destroyed state. The
 * underlying `schedule`/`cancel` are injected, which is what lets the test
 * harness drive the loop from fakes without touching GLib. */
export class Scheduler {
    #schedule;
    #cancel;
    #running = false;
    #timerId = 0;
    #generation = 0;

    constructor({ schedule, cancel }) {
        this.#schedule = schedule;
        this.#cancel = cancel;
    }

    get running() {
        return this.#running;
    }

    /* Start ticking. Any previously scheduled timer is cancelled first so
     * callers can change the interval without orphans. */
    start(delayMs, callback) {
        this.stop();
        this.#running = true;
        this.#generation += 1;
        this.#queue(delayMs, callback, this.#generation);
    }

    stop() {
        this.#running = false;
        this.#generation += 1;
        if (this.#timerId) {
            this.#cancel(this.#timerId);
            this.#timerId = 0;
        }
    }

    #queue(delayMs, callback, generation) {
        this.#timerId = this.#schedule(delayMs, async () => {
            if (generation !== this.#generation)
                return;
            this.#timerId = 0;
            try {
                await callback();
            } catch (_) {
                // Swallow so a transient failure does not stop polling.
            }
            if (generation === this.#generation && this.#running)
                this.#queue(delayMs, callback, generation);
        });
    }
}