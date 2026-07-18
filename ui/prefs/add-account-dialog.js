import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import { gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { PROVIDERS } from '../../providers/index.js';

export function showAddAccountDialog({ window, onAdd }) {
    const dialog = new Adw.MessageDialog({
        heading: _('Add Account'),
        body: _('Choose a provider and optional label.'),
        transient_for: window,
    });

    const box = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 12,
        margin_top: 12,
        margin_bottom: 12,
    });
    const providerIds = Object.keys(PROVIDERS);
    const providerModel = Gtk.StringList.new(
        providerIds.map(id => PROVIDERS[id].name));
    const providerCombo = new Gtk.DropDown({ model: providerModel });
    box.append(new Gtk.Label({ label: _('Provider'), halign: Gtk.Align.START }));
    box.append(providerCombo);

    const labelEntry = new Gtk.Entry({
        placeholder_text: _('Account label (optional)'),
    });
    box.append(new Gtk.Label({ label: _('Label'), halign: Gtk.Align.START }));
    box.append(labelEntry);
    dialog.set_extra_child(box);

    dialog.add_response('cancel', _('Cancel'));
    dialog.add_response('add', _('Add'));
    dialog.set_response_appearance('add', Adw.ResponseAppearance.SUGGESTED);
    dialog.connect('response', (opened, response) => {
        if (response === 'add') {
            const providerId = providerIds[providerCombo.get_selected()];
            onAdd(providerId, labelEntry.get_text().trim());
        }
        opened.close();
    });
    dialog.present();
}
