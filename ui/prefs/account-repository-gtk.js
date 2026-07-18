import * as config from '../../config.js';
import { createDefaultCredentials, PROVIDERS } from '../../providers/index.js';

export class GtkAccountRepository {
    #onError;

    constructor({ onError }) {
        this.#onError = onError;
    }

    load({ showError = true } = {}) {
        try {
            return config.load();
        } catch (e) {
            logError(e, 'AI Usage config could not be loaded');
            if (showError)
                this.#onError(e.message || String(e));
            return null;
        }
    }

    save(value) {
        if (config.save(value))
            return true;
        this.#onError('Could not save config.json. Check file permissions and logs.');
        return false;
    }

    createId() {
        return config.genId();
    }

    update(accountId, mutator) {
        const value = this.load();
        if (!value) return false;
        const account = value.accounts.find(candidate => candidate.id === accountId);
        if (!account) return false;
        account.credentials ??= {};
        mutator(account);
        return this.save(value);
    }

    remove(accountId) {
        const value = this.load();
        if (!value) return false;
        value.accounts = value.accounts.filter(account => account.id !== accountId);
        return this.save(value);
    }

    add(providerId, label) {
        const value = this.load();
        if (!value) return false;
        value.accounts.push({
            id: config.genId(),
            label: label || PROVIDERS[providerId]?.name || providerId,
            provider: providerId,
            enabled: true,
            credentials: createDefaultCredentials(providerId),
        });
        return this.save(value);
    }
}
