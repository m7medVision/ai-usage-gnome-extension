import {
    parseTokens,
    runZaiOAuth,
} from '../../../ui/prefs/zai-oauth-flow.js';

function assertEqual(actual, expected, message) {
    if (actual !== expected)
        throw new Error(`${message}: expected ${expected}, got ${actual}`);
}

function cancellable() {
    let cancelled = false;
    return {
        cancel: () => { cancelled = true; },
        is_cancelled: () => cancelled,
    };
}

async function testReadyFlowReturnsTokens() {
    const requests = [];
    const result = await runZaiOAuth({
        oauthConfig: { initUrl: 'https://init', pollUrl: 'https://poll', provider: 'zai' },
        cancellable: cancellable(),
        request: async request => {
            requests.push(request);
            if (request.method === 'POST') {
                return {
                    status: 200,
                    body: JSON.stringify({ authorize_url: 'https://auth', flow_id: 'flow' }),
                };
            }
            return {
                status: 200,
                body: JSON.stringify({
                    status: 'ready', token: 'access', refresh_token: 'refresh', expires_in: 300,
                }),
            };
        },
        sleep: async () => {},
        openUri: () => {},
    });

    assertEqual(result.token, 'access', 'access token');
    assertEqual(result.refreshToken, 'refresh', 'refresh token');
    assertEqual(result.expiresIn, 300, 'expiry');
    assertEqual(requests[1].url, 'https://poll/flow', 'poll URL');
}

async function testCancellationStopsBeforePollRequest() {
    const control = cancellable();
    let requestCount = 0;
    const result = await runZaiOAuth({
        oauthConfig: { initUrl: 'https://init', pollUrl: 'https://poll', provider: 'zai' },
        cancellable: control,
        request: async request => {
            requestCount += 1;
            return {
                status: 200,
                body: JSON.stringify({ authorize_url: 'https://auth', flow_id: 'flow' }),
            };
        },
        sleep: async () => { control.cancel(); },
        openUri: () => {},
    });

    assertEqual(result.cancelled, true, 'cancelled result');
    assertEqual(requestCount, 1, 'poll request not sent after cancellation');
}

function testNestedTokenShape() {
    const tokens = parseTokens({ data: { access_token: 'nested', expires_in: 60 } });
    assertEqual(tokens.token, 'nested', 'nested access token');
    assertEqual(tokens.expiresIn, 60, 'nested expiry');
}

await testReadyFlowReturnsTokens();
await testCancellationStopsBeforePollRequest();
testNestedTokenShape();
