/* Tabs view — provider tabs row across the top of the popup. Pure builder
 * functions over the St widget tree. The Indicator owns `_activeAccountId`
 * and `_tabsContainer`; this module renders into a passed-in container and
 * signals tab clicks through `onSelect(accountId)`. */

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';
import Clutter from 'gi://Clutter';

export const OVERVIEW_ID = '__overview__';

/* Build a provider logo icon if the logo file exists on disk. Returns null
 * for providers without a logoFile or when the file is missing — the caller
 * renders an unadorned label in that case. */
export function providerLogo(provider, extPath) {
    if (!provider.logoFile) return null;
    const path = GLib.build_filenamev([extPath, 'media', 'logos', provider.logoFile]);
    if (!GLib.file_test(path, GLib.FileTest.EXISTS)) return null;
    try {
        const styleClass = provider.fullColorLogo
            ? 'ai-usage-tab-icon-color'
            : 'ai-usage-tab-icon';
        return new St.Icon({
            gicon: Gio.Icon.new_for_string(path),
            style_class: styleClass,
        });
    } catch (e) {
        return null;
    }
}

/* Render the tabs row. Adds an Overview tab when more than one account is
 * configured, plus one tab per account. Active state is reflected via the
 * `ai-usage-tab-active` style class; tab clicks call `onSelect(accountId)`,
 * which may be OVERVIEW_ID for the synthetic overview tab. */
export function renderTabs({ container, accounts, activeAccountId,
                              showLogos, logoProvider, onSelect }) {
    container.destroy_all_children();

    const validIds = new Set(accounts.map(a => a.account.id));
    const showOverview = accounts.length > 1;
    if (showOverview) validIds.add(OVERVIEW_ID);

    let nextActive = activeAccountId;
    if (!validIds.has(nextActive))
        nextActive = showOverview ? OVERVIEW_ID : (accounts[0]?.account.id ?? null);

    if (showOverview)
        container.add_child(buildTab({
            label: 'Overview',
            isActive: nextActive === OVERVIEW_ID,
            onClick: () => onSelect(OVERVIEW_ID),
        }));

    for (const { account, provider } of accounts) {
        const inner = new St.BoxLayout({ y_align: Clutter.ActorAlign.CENTER });
        if (showLogos) {
            const logo = logoProvider(provider);
            if (logo) inner.add_child(logo);
        }
        inner.add_child(new St.Label({
            text: account.label || provider.name,
            y_align: Clutter.ActorAlign.CENTER,
        }));
        container.add_child(buildTab({
            child: inner,
            isActive: account.id === nextActive,
            onClick: () => onSelect(account.id),
        }));
    }

    return nextActive;
}

function buildTab({ label, child, isActive, onClick }) {
    const btn = new St.Button({
        style_class: 'ai-usage-tab',
        can_focus: true,
    });
    btn.set_child(child ?? new St.Label({
        text: label,
        y_align: Clutter.ActorAlign.CENTER,
    }));
    if (isActive)
        btn.add_style_class_name('ai-usage-tab-active');
    btn.connect('clicked', () => {
        onClick();
        return Clutter.EVENT_PROPAGATE;
    });
    return btn;
}
