export class RefreshLoop {
    #cancel;
    #delayMs = 0;
    #fetch;
    #generation = 0;
    #pending = null;
    #refreshAfterPending = false;
    #schedule;
    #stopped = true;
    #timerId = 0;

    constructor({ fetch, schedule, cancel }) {
        this.#fetch = fetch;
        this.#schedule = schedule;
        this.#cancel = cancel;
    }

    start(delayMs) {
        this.stop();
        this.#stopped = false;
        this.#delayMs = delayMs;
        this.#queueNext(this.#generation);
        if (this.#pending)
            this.#refreshAfterPending = true;
        return this.refresh();
    }

    refresh() {
        if (this.#stopped)
            return Promise.resolve();
        if (!this.#pending) {
            this.#pending = Promise.resolve()
                .then(this.#fetch);
            this.#pending.then(
                () => this.#finishRefresh(),
                () => this.#finishRefresh());
        }
        return this.#pending;
    }

    stop() {
        this.#stopped = true;
        this.#generation += 1;
        this.#refreshAfterPending = false;
        if (this.#timerId)
            this.#cancel(this.#timerId);
        this.#timerId = 0;
    }

    #finishRefresh() {
        this.#pending = null;
        if (!this.#refreshAfterPending || this.#stopped)
            return;
        this.#refreshAfterPending = false;
        this.refresh().catch(() => {});
    }

    #queueNext(generation) {
        this.#timerId = this.#schedule(this.#delayMs, async () => {
            if (generation === this.#generation)
                this.#timerId = 0;
            try {
                await this.refresh();
            } finally {
                if (!this.#stopped && generation === this.#generation)
                    this.#queueNext(generation);
            }
        });
    }
}
