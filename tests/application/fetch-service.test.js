import { FetchService } from '../../application/fetch-service.js';

function assertEqual(actual, expected, message) {
    if (actual !== expected)
        throw new Error(`${message}: expected ${expected}, got ${actual}`);
}

async function testFetchAllReturnsResultsByAccountId() {
    // Arrange
    const session = {};
    const expected = { attempted: true, entries: [{ kind: 'value' }], errors: [] };
    const provider = {
        async fetch(receivedSession, credentials) {
            assertEqual(receivedSession, session, 'provider session');
            assertEqual(credentials.token, 'secret', 'provider credentials');
            return expected;
        },
    };
    const service = new FetchService({ session, logger: () => {} });

    // Act
    const results = await service.fetchAll([{
        account: { id: 'acc_1', label: 'Primary', credentials: { token: 'secret' } },
        provider,
    }]);

    // Assert
    assertEqual(results.get('acc_1'), expected, 'result keyed by account id');
}

async function testFetchAllIsolatesProviderFailure() {
    // Arrange
    const success = { attempted: false, entries: [], errors: [] };
    const service = new FetchService({ session: {}, logger: () => {} });
    const accounts = [
        {
            account: { id: 'ok', label: 'OK', credentials: {} },
            provider: { fetch: async () => success },
        },
        {
            account: { id: 'bad', label: 'Broken', credentials: {} },
            provider: { fetch: async () => { throw new Error('network down'); } },
        },
    ];

    // Act
    const results = await service.fetchAll(accounts);

    // Assert
    assertEqual(results.get('ok'), success, 'successful result preserved');
    assertEqual(results.get('bad').attempted, true, 'failed request was attempted');
    assertEqual(results.get('bad').entries.length, 0, 'failed request has no entries');
    assertEqual(results.get('bad').errors[0], 'Broken: network down', 'error envelope');
}

await testFetchAllReturnsResultsByAccountId();
await testFetchAllIsolatesProviderFailure();
