export function importDetectedAccounts(existingAccounts, candidates, dependencies) {
    const accounts = [...existingAccounts];
    const added = [];
    const skipped = [];

    for (const candidate of candidates) {
        if (isAlreadyConfigured(accounts, candidate)) {
            skipped.push(candidate.label);
            continue;
        }
        accounts.push({
            id: dependencies.createId(),
            label: candidate.label,
            provider: candidate.provider,
            enabled: true,
            credentials: {
                ...dependencies.createDefaultCredentials(candidate.provider),
                ...candidate.credentials,
            },
        });
        added.push(candidate.label);
    }

    return { accounts, added, skipped };
}

export function isAlreadyConfigured(accounts, candidate) {
    return accounts
        .filter(account => account.provider === candidate.provider)
        .some(account => {
            const credentials = account.credentials || {};
            return candidate.identityKey && (
                credentials.oauthToken === candidate.identityKey ||
                credentials.apiKey === candidate.identityKey ||
                credentials.accountId === candidate.identityKey);
        });
}
