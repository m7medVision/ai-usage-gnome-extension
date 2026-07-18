import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import { gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export function buildGeneralPage(window, settings) {
    const page = new Adw.PreferencesPage({
        title: _('General'),
        icon_name: 'emblem-system-symbolic',
    });
    window.add(page);

    const displayGroup = new Adw.PreferencesGroup({ title: _('Panel Display') });
    page.add(displayGroup);

    const displayModeRow = new Adw.ComboRow({
        title: _('Display mode'),
        subtitle: _('Whether the meter and bars reflect used or remaining quota.'),
        model: Gtk.StringList.new([_('Used'), _('Remaining')]),
        selected: settings.get_string('display-mode') === 'remaining' ? 1 : 0,
    });
    displayGroup.add(displayModeRow);
    displayModeRow.connect('notify::selected', row => {
        settings.set_string('display-mode', row.selected === 1 ? 'remaining' : 'used');
    });

    const showLogosRow = new Adw.SwitchRow({
        title: _('Show provider logos'),
        subtitle: _('Display provider logos on the tabs in the popup menu.'),
        active: settings.get_boolean('show-logos'),
    });
    displayGroup.add(showLogosRow);
    showLogosRow.connect('notify::active', row => {
        settings.set_boolean('show-logos', row.active);
    });

    const thresholdGroup = new Adw.PreferencesGroup({ title: _('Usage Thresholds') });
    page.add(thresholdGroup);
    thresholdGroup.add(thresholdRow({
        title: _('High usage threshold'),
        subtitle: _('Indicator turns orange above this percentage.'),
        value: settings.get_int('high-usage-threshold'),
        minimum: 50,
        onChange: value => settings.set_int('high-usage-threshold', value),
    }));
    thresholdGroup.add(thresholdRow({
        title: _('Critical usage threshold'),
        subtitle: _('Indicator turns red above this percentage.'),
        value: settings.get_int('critical-usage-threshold'),
        minimum: 60,
        onChange: value => settings.set_int('critical-usage-threshold', value),
    }));
}

function thresholdRow({ title, subtitle, value, minimum, onChange }) {
    const row = new Adw.SpinRow({
        title,
        subtitle,
        adjustment: Gtk.Adjustment.new(value, minimum, 100, 1, 5, 0),
        climb_rate: 1,
        digits: 0,
    });
    row.connect('notify::value', changed => onChange(Math.round(changed.value)));
    return row;
}
