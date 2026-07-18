import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import { gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { PROVIDERS } from '../../providers/index.js';
import { renderCredentialFields } from './credentials-fields/index.js';

export function buildAccountRow({
    account,
    onUpdate,
    onRemove,
    onStartZaiOAuth,
    onLogoutZaiOAuth,
}) {
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

    renderCredentialFields(row, account, {
        onUpdate,
        onStartZaiOAuth,
        onLogoutZaiOAuth,
    });

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

function entryRow(title, text, hidden, onApply) {
    const entry = new Adw.EntryRow({ title });
    entry.set_text(text);
    entry.set_show_apply_button(true);
    if (hidden) entry.visibility = false;
    entry.connect('apply', () => onApply(entry.get_text().trim()));
    return entry;
}
