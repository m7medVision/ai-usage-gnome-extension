import {
    parseTokens,
    runZaiOAuth,
    validateAuthorizeUrl,
} from '../../../providers/zai-oauth.js';

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
                    body: JSON.stringify({ authorize_url: 'https://chat.z.ai', flow_id: 'flow' }),
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
                body: JSON.stringify({ authorize_url: 'https://chat.z.ai', flow_id: 'flow' }),
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

async function testCancelledBeforeStartSendsNoRequest() {
    const control = cancellable();
    control.cancel();
    let requestCount = 0;
    const result = await runZaiOAuth({
        oauthConfig: { initUrl: 'https://init', pollUrl: 'https://poll', provider: 'zai' },
        cancellable: control,
        request: async () => { requestCount += 1; },
    });
    assertEqual(result.cancelled, true, 'pre-cancelled result');
    assertEqual(requestCount, 0, 'pre-cancelled request count');
}

function testAuthorizeUrlAllowlist() {
    validateAuthorizeUrl('https://chat.z.ai/oauth', 'zai');
    let rejected = false;
    try { validateAuthorizeUrl('file:///tmp/fake-login', 'zai'); } catch (e) { rejected = true; }
    assertEqual(rejected, true, 'non-HTTPS authorization URI rejected');
}

await testReadyFlowReturnsTokens();
await testCancellationStopsBeforePollRequest();
await testCancelledBeforeStartSendsNoRequest();
testNestedTokenShape();
testAuthorizeUrlAllowlist();
