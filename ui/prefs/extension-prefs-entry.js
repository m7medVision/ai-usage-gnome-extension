import Gio from 'gi://Gio';
import Adw from 'gi://Adw';
import {
    ExtensionPreferences,
    gettext as _,
} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { PROVIDERS } from '../../providers/index.js';
import { GtkAccountRepository } from './account-repository-gtk.js';
import { AccountsPage } from './accounts-page.js';
import { buildGeneralPage } from './general-page.js';
import { buildRefreshPage } from './refresh-page.js';
import { runZaiOAuth } from './zai-oauth-flow.js';

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
            onLogoutZaiOAuth: (account, logout) =>
                this._logoutZaiOAuth(account, logout),
        });
        buildRefreshPage(window, settings);
        window.connect('close-request', () => {
            this._closing = true;
            this._cancelOAuth();
            return false;
        });
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

    async _startZaiOAuth(account, statusRow, loginBtn, logoutBtn) {
        this._cancelOAuth();
        const cancellable = new Gio.Cancellable();
        this._oauthCancellable = cancellable;
        this._oauthAccountId = account.id;
        loginBtn.sensitive = false;

        try {
            const result = await runZaiOAuth({
                oauthConfig: PROVIDERS.zai.getOAuthConfig(account.credentials || {}),
                cancellable,
                events: {
                    initializing: () => {
                        loginBtn.label = _('Starting login...');
                        statusRow.set_subtitle(_('Initializing OAuth flow...'));
                    },
                    waitingForBrowser: () => {
                        loginBtn.label = _('Waiting for authentication...');
                        statusRow.set_subtitle(_('Open browser to complete login...'));
                    },
                    browserFallback: url => statusRow.set_subtitle(_(`Open: ${url}`)),
                    polling: attempt => { loginBtn.label = _(`Waiting... (${attempt}s)`); },
                },
            });
            if (result.cancelled) {
                if (!this._closing) {
                    statusRow.set_subtitle(_('Login cancelled'));
                    loginBtn.label = _('Log In with Z.AI');
                    loginBtn.sensitive = true;
                }
                return;
            }

            const saved = this._repository.update(account.id, changed => {
                changed.credentials.oauthToken = result.token;
                if (result.refreshToken)
                    changed.credentials.oauthRefresh = result.refreshToken;
                if (result.expiresIn > 0) {
                    changed.credentials.oauthExpiry =
                        Math.floor(Date.now() / 1000) + result.expiresIn;
                }
            });
            if (!saved)
                throw new Error('Could not save OAuth credentials');
            statusRow.set_subtitle(_('Logged in via OAuth'));
            loginBtn.label = _('Log In with Z.AI');
            loginBtn.sensitive = true;
            logoutBtn.visible = true;
        } catch (e) {
            if (cancellable.is_cancelled()) return;
            logError(e, 'Z.AI OAuth flow failed');
            statusRow.set_subtitle(`Login failed: ${e.message}`);
            loginBtn.label = _('Log In with Z.AI');
            loginBtn.sensitive = true;
        } finally {
            if (this._oauthCancellable === cancellable)
                this._oauthCancellable = null;
            if (this._oauthAccountId === account.id)
                this._oauthAccountId = null;
        }
    }

    _logoutZaiOAuth(account, logoutBtn) {
        if (this._oauthAccountId === account.id)
            this._cancelOAuth();
        const saved = this._repository.update(account.id, changed => {
            changed.credentials.oauthToken = '';
            changed.credentials.oauthRefresh = '';
            changed.credentials.oauthExpiry = 0;
        });
        if (saved)
            logoutBtn.visible = false;
    }

    _cancelOAuth() {
        this._oauthCancellable?.cancel();
        this._oauthCancellable = null;
        this._oauthAccountId = null;
    }
}
