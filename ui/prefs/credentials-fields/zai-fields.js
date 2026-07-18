import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import { gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { addCredentialField } from './shared.js';

export function renderZaiFields(row, account, context) {
    const credentials = account.credentials || {};
    const endpoint = new Adw.ComboRow({
        title: _('Region'),
        model: Gtk.StringList.new([
            _('International (api.z.ai)'), _('China (open.bigmodel.cn)'),
        ]),
        selected: credentials.endpoint === 'cn' ? 1 : 0,
    });
    endpoint.connect('notify::selected', changed => {
        context.onUpdate(account.id, value => {
            value.credentials.endpoint = changed.selected === 1 ? 'cn' : 'intl';
        });
    });
    row.add_row(endpoint);
    addCredentialField(row, account, _('API Key'), 'apiKey', true, context);

    const oauthRow = new Adw.ActionRow({ title: _('OAuth Login') });
    const login = new Gtk.Button({
        label: _('Log In with Z.AI'),
        css_classes: ['suggested-action'],
        valign: Gtk.Align.CENTER,
    });
    const logout = new Gtk.Button({
        label: _('Log Out'),
        css_classes: ['destructive-action'],
        valign: Gtk.Align.CENTER,
        visible: !!credentials.oauthToken,
    });
    login.connect('clicked', () =>
        context.onStartZaiOAuth(account, oauthRow, login, logout));
    logout.connect('clicked', () => context.onLogoutZaiOAuth(account, logout));
    oauthRow.add_suffix(login);
    oauthRow.add_suffix(logout);
    row.add_row(oauthRow);
}
