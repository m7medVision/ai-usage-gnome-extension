import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import { gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export function buildRefreshPage(window, settings) {
    const page = new Adw.PreferencesPage({
        title: _('Refresh'),
        icon_name: 'view-refresh-symbolic',
    });
    window.add(page);

    const group = new Adw.PreferencesGroup({
        title: _('Update Interval'),
        description: _('How often to fetch usage data from all enabled accounts.'),
    });
    page.add(group);

    const intervalRow = new Adw.SpinRow({
        title: _('Refresh interval (seconds)'),
        adjustment: Gtk.Adjustment.new(
            settings.get_int('refresh-interval'), 30, 3600, 10, 30, 0),
        climb_rate: 10,
        digits: 0,
    });
    group.add(intervalRow);
    intervalRow.connect('notify::value', row => {
        settings.set_int('refresh-interval', Math.round(row.value));
    });
}
