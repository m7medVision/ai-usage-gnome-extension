import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup?version=3.0';

export async function runZaiOAuth({
    oauthConfig,
    cancellable,
    events = {},
    request = sendRequest,
    sleep = delay,
    openUri = uri => Gio.AppInfo.launch_default_for_uri(uri, null),
    maxAttempts = 120,
}) {
    events.initializing?.();
    const init = await request({
        method: 'POST',
        url: oauthConfig.initUrl,
        body: JSON.stringify({ provider: oauthConfig.provider }),
        cancellable,
    });
    if (isCancelled(cancellable)) return { cancelled: true };
    if (init.status !== 200)
        throw new Error(`OAuth init failed: HTTP ${init.status}`);

    const initData = JSON.parse(init.body);
    const authUrl = initData.authorize_url ?? initData.data?.authorize_url;
    const flowId = initData.flow_id ?? initData.data?.flow_id;
    const pollToken = initData.poll_token ?? initData.data?.poll_token;
    if (!authUrl || !flowId)
        throw new Error('Unexpected OAuth init response');

    events.waitingForBrowser?.(authUrl);
    try { openUri(authUrl); } catch (e) { events.browserFallback?.(authUrl); }

    const pollUrl = `${oauthConfig.pollUrl}/${flowId}`;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        await sleep(1000, cancellable);
        if (isCancelled(cancellable)) return { cancelled: true };
        events.polling?.(attempt);

        const result = await request({
            method: 'GET',
            url: pollUrl,
            bearerToken: pollToken,
            cancellable,
        });
        if (isCancelled(cancellable)) return { cancelled: true };
        if (result.status !== 200) continue;

        const data = JSON.parse(result.body);
        const status = data.status ?? data.data?.status ?? 'pending';
        if (status === 'ready')
            return parseTokens(data);
        if (status === 'failed')
            throw new Error(data.message ?? data.error ?? 'Authentication failed');
    }

    throw new Error('Authentication timed out. Please try again.');
}

export function parseTokens(data) {
    const token = data.token ?? data.access_token
        ?? data.data?.token ?? data.data?.access_token;
    if (!token)
        throw new Error('OAuth succeeded but no token returned');
    return {
        token,
        refreshToken: data.refresh_token ?? data.data?.refresh_token ?? '',
        expiresIn: data.expires_in ?? data.data?.expires_in ?? 0,
    };
}

function sendRequest({ method, url, body, bearerToken, cancellable }) {
    const session = new Soup.Session();
    const message = Soup.Message.new(method, url);
    if (body) {
        message.set_request_body_from_bytes(
            'application/json', new GLib.Bytes(new TextEncoder().encode(body)));
    }
    if (bearerToken)
        message.get_request_headers().append('Authorization', `Bearer ${bearerToken}`);

    return new Promise((resolve, reject) => {
        session.send_and_read_async(
            message, GLib.PRIORITY_DEFAULT, cancellable, (source, result) => {
                try {
                    const bytes = source.send_and_read_finish(result);
                    resolve({
                        status: message.get_status(),
                        body: new TextDecoder().decode(
                            bytes?.get_data() ?? new Uint8Array(0)),
                    });
                } catch (e) {
                    if (isCancelled(cancellable)) resolve({ cancelled: true });
                    else reject(e);
                }
            });
    });
}

function delay(ms, cancellable) {
    return new Promise(resolve => {
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
            resolve();
            return GLib.SOURCE_REMOVE;
        });
        if (isCancelled(cancellable)) resolve();
    });
}

function isCancelled(cancellable) {
    return cancellable?.is_cancelled?.() === true;
}
