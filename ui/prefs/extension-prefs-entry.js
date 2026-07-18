import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Adw from 'gi://Adw';
import Soup from 'gi://Soup?version=3.0';
import {
    ExtensionPreferences,
    gettext as _,
} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { PROVIDERS } from '../../providers/index.js';
import { GtkAccountRepository } from './account-repository-gtk.js';
import { AccountsPage } from './accounts-page.js';
import { buildGeneralPage } from './general-page.js';
import { buildRefreshPage } from './refresh-page.js';

export default class AiUsagePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        this._window = window;
        this._repository = new GtkAccountRepository({
            onError: message => this._showConfigError(message),
        });

        buildGeneralPage(window, settings);
        this._accountsPage = new AccountsPage({
            window,
            repository: this._repository,
            onStartZaiOAuth: (account, statusRow, login, logout) =>
                this._startZaiOAuth(account, statusRow, login, logout),
        });
        buildRefreshPage(window, settings);
    }

    _showConfigError(message) {
        const dialog = new Adw.MessageDialog({
            heading: _('Configuration error'),
            body: message,
            transient_for: this._window,
        });
        dialog.add_response('ok', _('OK'));
        dialog.present();
    }

    /* Temporary ownership: Commit J moves this HTTP/polling use case to
     * zai-oauth-flow.js and adds cancellation on window close. */
    async _startZaiOAuth(account, statusRow, loginBtn, logoutBtn) {
        const credentials = account.credentials || {};
        const oauthConfig = PROVIDERS.zai.getOAuthConfig(credentials);

        loginBtn.sensitive = false;
        loginBtn.label = _('Starting login...');
        statusRow.set_subtitle(_('Initializing OAuth flow...'));

        try {
            const session = new Soup.Session();
            const initResult = await sendJson(
                session,
                Soup.Message.new('POST', oauthConfig.initUrl),
                JSON.stringify({ provider: oauthConfig.provider }));

            if (initResult.status !== 200)
                throw new Error(`OAuth init failed: HTTP ${initResult.status}`);

            const initData = JSON.parse(initResult.body);
            const authUrl = initData.authorize_url ?? initData.data?.authorize_url;
            const flowId = initData.flow_id ?? initData.data?.flow_id;
            const pollToken = initData.poll_token ?? initData.data?.poll_token;
            if (!authUrl || !flowId)
                throw new Error('Unexpected OAuth init response');

            statusRow.set_subtitle(_('Open browser to complete login...'));
            loginBtn.label = _('Waiting for authentication...');
            try { Gio.AppInfo.launch_default_for_uri(authUrl, null); } catch (e) {
                statusRow.set_subtitle(_(`Open: ${authUrl}`));
            }

            const pollUrl = `${oauthConfig.pollUrl}/${flowId}`;
            for (let attempt = 1; attempt <= 120; attempt++) {
                await sleep(1000);
                loginBtn.label = _(`Waiting... (${attempt}s)`);
                const message = Soup.Message.new('GET', pollUrl);
                if (pollToken)
                    message.get_request_headers().append('Authorization', `Bearer ${pollToken}`);
                const result = await send(session, message);
                if (result.status !== 200) continue;

                const data = JSON.parse(result.body);
                const status = data.status ?? data.data?.status ?? 'pending';
                if (status === 'ready') {
                    this._completeOAuth(account.id, data);
                    statusRow.set_subtitle(_('Logged in via OAuth'));
                    loginBtn.label = _('Log In with Z.AI');
                    loginBtn.sensitive = true;
                    logoutBtn.visible = true;
                    return;
                }
                if (status === 'failed')
                    throw new Error(data.message ?? data.error ?? 'Authentication failed');
            }
            throw new Error('Authentication timed out. Please try again.');
        } catch (e) {
            logError(e, 'Z.AI OAuth flow failed');
            statusRow.set_subtitle(`Login failed: ${e.message}`);
            loginBtn.label = _('Log In with Z.AI');
            loginBtn.sensitive = true;
        }
    }

    _completeOAuth(accountId, data) {
        const token = data.token ?? data.access_token
            ?? data.data?.token ?? data.data?.access_token;
        const refreshToken = data.refresh_token ?? data.data?.refresh_token ?? '';
        const expiresIn = data.expires_in ?? data.data?.expires_in ?? 0;
        if (!token)
            throw new Error('OAuth succeeded but no token returned');

        this._repository.update(accountId, account => {
            account.credentials.oauthToken = token;
            if (refreshToken) account.credentials.oauthRefresh = refreshToken;
            if (expiresIn > 0)
                account.credentials.oauthExpiry = Math.floor(Date.now() / 1000) + expiresIn;
        });
    }
}

function sendJson(session, message, body) {
    message.set_request_body_from_bytes(
        'application/json', new GLib.Bytes(new TextEncoder().encode(body)));
    return send(session, message);
}

function send(session, message) {
    return new Promise((resolve, reject) => {
        session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (source, result) => {
            try {
                const bytes = source.send_and_read_finish(result);
                const body = new TextDecoder().decode(
                    bytes?.get_data() ?? new Uint8Array(0));
                resolve({ status: message.get_status(), body });
            } catch (e) {
                reject(e);
            }
        });
    });
}

function sleep(ms) {
    return new Promise(resolve => {
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
            resolve();
            return GLib.SOURCE_REMOVE;
        });
    });
}
