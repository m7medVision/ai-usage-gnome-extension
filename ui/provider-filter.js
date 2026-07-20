/* Pure selection rules shared by the provider popup and content renderer. */

export const OVERVIEW_ID = '__overview__';

/* Preserve configured-account order while exposing each provider once. */
export function providerOptions(accounts) {
    const seen = new Set();
    return accounts.filter(({ account }) => {
        if (seen.has(account.provider))
            return false;
        seen.add(account.provider);
        return true;
    }).map(({ account, provider }) => ({
        id: account.provider,
        label: provider.name,
    }));
}

export function normalizeProviderSelection(accounts, activeProviderId) {
    return providerOptions(accounts).some(({ id }) => id === activeProviderId)
        ? activeProviderId
        : OVERVIEW_ID;
}

export function selectedProviderAccounts(accounts, activeProviderId) {
    if (activeProviderId === OVERVIEW_ID)
        return accounts;
    return accounts.filter(({ account }) => account.provider === activeProviderId);
}
