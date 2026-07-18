/* SingleFlight — coalesces concurrent calls to an async operation onto one
 * in-flight promise. Two `run()` calls that arrive while one is already
 * running share the same promise and trigger the underlying fn at most once.
 *
 * A refire is opt-in: `requestRefire()` arms "after the current settle, run
 * once more" so callers that intentionally want fresh data after a settings
 * change (RefreshService.start) can request it. Tearing down calls `cancel()`
 * to drop any armed refire. */
// ponytail: speculative split per architecture review, kept per direction.
// Single-flight and refire live together because refire *is* the coalescing
// decision — splitting them across Scheduler would duplicate the pending
// state across two modules.
export class SingleFlight {
    #fn;
    #pending = null;
    #refire = false;

    constructor(fn) {
        this.#fn = fn;
    }

    /* Returns a promise that resolves when the current run settles. The
     * underlying fn's rejections are absorbed here so callers cannot surface
     * an unhandled rejection into GJS — providers already file failures into
     * per-account `errors[]`, rendered in the panel. */
    run() {
        if (this.#pending)
            return this.#pending;
        this.#pending = Promise.resolve()
            .then(this.#fn)
            .then(() => this.#settle(), () => this.#settle());
        return this.#pending;
    }

    /* Arm "after the current run settles, run once more". No-op if nothing
     * is pending at the call moment; a plain `run()` after settle is not a
     * refire. The intent is "the latest state changed mid-fetch, please
     * refresh again once the current fetch finishes." */
    requestRefire() {
        if (this.#pending)
            this.#refire = true;
    }

    get inFlight() {
        return !!this.#pending;
    }

    /* Drop any pending refire. A subsequent settle will not re-arm. */
    cancel() {
        this.#refire = false;
    }

    #settle() {
        this.#pending = null;
        const shouldRefire = this.#refire;
        this.#refire = false;
        if (shouldRefire)
            this.run().catch(() => {});
    }
}