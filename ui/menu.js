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
        y_align: Clutter.ActorAlign.CENTER,
    });
    headerBox.add_child(headerTitle);

    const providerSelectorButton = new St.Button({
        style_class: 'ai-usage-header-button ai-usage-provider-selector',
        can_focus: true,
    });
    const providerSelectorContent = new St.BoxLayout({
        style_class: 'ai-usage-provider-selector-content',
    });
    const providerSelectorLabel = new St.Label({
        text: 'Overview',
        style_class: 'ai-usage-provider-selector-label',
        y_align: Clutter.ActorAlign.CENTER,
    });
    providerSelectorContent.add_child(providerSelectorLabel);
    providerSelectorContent.add_child(new St.Icon({
        icon_name: 'pan-down-symbolic',
        style_class: 'ai-usage-provider-selector-arrow',
        y_align: Clutter.ActorAlign.CENTER,
    }));
    providerSelectorButton.set_child(providerSelectorContent);
    headerBox.add_child(providerSelectorButton);
    headerBox.add_child(new St.Widget({ x_expand: true }));

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

    const contentBox = new St.BoxLayout({
        style_class: 'ai-usage-usage-section',
        vertical: true,
    });
    menuBox.add_child(contentBox);

    return {
        headerBox,
        headerTitle,
        providerSelectorButton,
        providerSelectorLabel,
        refreshBtn,
        settingsBtn,
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
