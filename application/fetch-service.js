export class FetchService {
    #session;
    #logger;

    constructor({ session, logger = message => log(message) }) {
        this.#session = session;
        this.#logger = logger;
    }

    async fetchAll(accounts) {
        this.#logger(`[ai-usage] Fetching ${accounts.length} account(s)`);
        const results = await Promise.all(accounts.map(({ account, provider }) =>
            this.#fetchAccount(account, provider)));
        return new Map(results);
    }

    async #fetchAccount(account, provider) {
        try {
            const result = await provider.fetch(this.#session, account.credentials);
            this.#logger(
                `[ai-usage] ${account.label}: attempted=${result.attempted} ` +
                `entries=${result.entries?.length || 0} errors=${result.errors?.length || 0}`);
            return [account.id, result];
        } catch (e) {
            return [account.id, {
                attempted: true,
                entries: [],
                errors: [`${account.label}: ${e.message || e}`],
            }];
        }
    }
}
