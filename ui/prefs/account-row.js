import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import { gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { PROVIDERS } from '../../providers/index.js';

export function buildAccountRow({ account, onUpdate, onRemove, onStartZaiOAuth }) {
    const providerName = PROVIDERS[account.provider]?.name || account.provider;
    const row = new Adw.ExpanderRow({
        title: account.label || providerName,
        subtitle: providerName,
    });

    const enabled = new Gtk.Switch({
        active: account.enabled !== false,
        valign: Gtk.Align.CENTER,
    });
    row.add_suffix(enabled);
    enabled.connect('notify::active', widget => {
        onUpdate(account.id, changed => { changed.enabled = widget.active; });
    });

    const labelBox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 6,
        margin_top: 12,
        margin_bottom: 12,
        margin_start: 12,
        margin_end: 12,
    });
    const labelEntry = entryRow(_('Account label'), account.label || '', false, value =>
        onUpdate(account.id, changed => { changed.label = value; }));
    labelBox.append(labelEntry);
    row.add_row(labelBox);

    addCredentialRows(row, account, onUpdate, onStartZaiOAuth);

    const removeBox = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        halign: Gtk.Align.CENTER,
        margin_top: 12,
        margin_bottom: 12,
    });
    const remove = new Gtk.Button({
        label: _('Remove Account'),
        css_classes: ['destructive-action'],
    });
    remove.connect('clicked', () => onRemove(account.id));
    removeBox.append(remove);
    row.add_row(removeBox);
    return row;
}

function addCredentialRows(row, account, onUpdate, onStartZaiOAuth) {
    const credentials = account.credentials || {};
    if (account.provider === 'zai')
        addZaiRows(row, account, credentials, onUpdate, onStartZaiOAuth);
    if (account.provider === 'opencode-go') {
        addField(row, account, _('Workspace ID'), 'workspaceId', false, credentials, onUpdate);
        addField(row, account, _('Auth Cookie'), 'authCookie', true, credentials, onUpdate);
        addField(row, account, _('Server ID (x-server-id)'), 'serverId', false, credentials, onUpdate);
    }
    if (account.provider === 'openai') {
        addField(row, account, _('OAuth Access Token'), 'oauthToken', true, credentials, onUpdate);
        addField(row, account, _('Refresh Token (optional)'), 'oauthRefresh', true, credentials, onUpdate);
    }
    if (account.provider === 'deepseek')
        addField(row, account, _('API Key'), 'apiKey', true, credentials, onUpdate);
    if (account.provider === 'claude-code') {
        if (credentials.autoDetect) {
            row.add_row(new Adw.ActionRow({
                title: _('Source'),
                subtitle: _('Auto-detected from ~/.claude/.credentials.json'),
            }));
        } else {
            addField(row, account, _('OAuth Access Token'), 'oauthToken', true, credentials, onUpdate);
        }
    }
}

function addZaiRows(row, account, credentials, onUpdate, onStartZaiOAuth) {
    const endpoint = new Adw.ComboRow({
        title: _('Region'),
        model: Gtk.StringList.new([
            _('International (api.z.ai)'), _('China (open.bigmodel.cn)'),
        ]),
        selected: credentials.endpoint === 'cn' ? 1 : 0,
    });
    endpoint.connect('notify::selected', changed =>
        onUpdate(account.id, value => {
            value.credentials.endpoint = changed.selected === 1 ? 'cn' : 'intl';
        }));
    row.add_row(endpoint);
    addField(row, account, _('API Key'), 'apiKey', true, credentials, onUpdate);

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
    login.connect('clicked', () => onStartZaiOAuth(account, oauthRow, login, logout));
    logout.connect('clicked', () => {
        onUpdate(account.id, value => {
            value.credentials.oauthToken = '';
            value.credentials.oauthRefresh = '';
            value.credentials.oauthExpiry = 0;
        });
        logout.visible = false;
    });
    oauthRow.add_suffix(login);
    oauthRow.add_suffix(logout);
    row.add_row(oauthRow);
}

function addField(row, account, title, key, hidden, credentials, onUpdate) {
    row.add_row(entryRow(title, credentials[key] || '', hidden, value =>
        onUpdate(account.id, changed => { changed.credentials[key] = value; })));
}

function entryRow(title, text, hidden, onApply) {
    const entry = new Adw.EntryRow({ title });
    entry.set_text(text);
    entry.set_show_apply_button(true);
    if (hidden) entry.visibility = false;
    entry.connect('apply', () => onApply(entry.get_text().trim()));
    return entry;
}
