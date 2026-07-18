import St from 'gi://St';
import Clutter from 'gi://Clutter';

export function buildMenu({ menuBox, onRefresh, onOpenPreferences }) {
    menuBox.add_style_class_name('ai-usage-popup');

    const headerBox = new St.BoxLayout({
        style_class: 'ai-usage-header',
        x_expand: true,
    });
    const headerTitle = new St.Label({
        text: 'AI Usage',
        style_class: 'ai-usage-header-title',
        x_expand: true,
        y_align: Clutter.ActorAlign.CENTER,
    });
    headerBox.add_child(headerTitle);

    const refreshBtn = iconButton('view-refresh-symbolic');
    refreshBtn.connect('clicked', () => {
        onRefresh();
        return Clutter.EVENT_PROPAGATE;
    });
    headerBox.add_child(refreshBtn);

    const settingsBtn = iconButton('preferences-system-symbolic');
    settingsBtn.connect('clicked', () => {
        onOpenPreferences();
        return Clutter.EVENT_PROPAGATE;
    });
    headerBox.add_child(settingsBtn);
    menuBox.add_child(headerBox);

    const tabsContainer = new St.BoxLayout({
        style_class: 'ai-usage-tabs-container',
    });
    menuBox.add_child(tabsContainer);

    const contentBox = new St.BoxLayout({
        style_class: 'ai-usage-usage-section',
        vertical: true,
    });
    menuBox.add_child(contentBox);

    return {
        headerBox,
        headerTitle,
        refreshBtn,
        settingsBtn,
        tabsContainer,
        contentBox,
    };
}

function iconButton(iconName) {
    const button = new St.Button({
        style_class: 'ai-usage-header-button',
        can_focus: true,
    });
    button.set_child(new St.Icon({
        icon_name: iconName,
        style_class: 'ai-usage-header-button-icon',
    }));
    return button;
}
