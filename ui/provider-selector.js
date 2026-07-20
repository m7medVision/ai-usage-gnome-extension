import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {
    OVERVIEW_ID,
    normalizeProviderSelection,
    providerOptions,
} from './provider-filter.js';

/* Own the detached native popup menu anchored to the header selector button. */
export function createProviderSelector({ button, label, onSelect }) {
    const menu = new PopupMenu.PopupMenu(button, 0.5, St.Side.TOP);
    const menuManager = new PopupMenu.PopupMenuManager(button);
    Main.uiGroup.add_child(menu.actor);
    menu.actor.hide();
    menuManager.addMenu(menu);

    let activeProviderId = OVERVIEW_ID;
    let options = [];
    const items = new Map();
    const buttonClickId = button.connect('clicked', () => menu.toggle());

    function selectedLabel() {
        return options.find(({ id }) => id === activeProviderId)?.label ?? 'Overview';
    }

    function syncSelection() {
        const text = selectedLabel();
        label.set_text(text);
        button.accessible_name = `Select usage provider: ${text}`;
        for (const [id, item] of items)
            item.setOrnament(id === activeProviderId
                ? PopupMenu.Ornament.CHECK
                : PopupMenu.Ornament.NONE);
    }

    function addChoice(id, text) {
        const item = new PopupMenu.PopupMenuItem(text);
        item.connect('activate', () => {
            activeProviderId = id;
            syncSelection();
            onSelect(activeProviderId);
        });
        menu.addMenuItem(item);
        items.set(id, item);
    }

    function render({ accounts, selectedId }) {
        options = providerOptions(accounts);
        activeProviderId = normalizeProviderSelection(accounts, selectedId);

        menu.close();
        menu.removeAll();
        items.clear();
        addChoice(OVERVIEW_ID, '📊 Overview');
        if (options.length)
            menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        for (const { id, label: optionLabel } of options)
            addChoice(id, optionLabel);
        syncSelection();

        return activeProviderId;
    }

    function close() {
        menu.close();
    }

    function destroy() {
        close();
        button.disconnect(buttonClickId);
        menuManager.removeMenu(menu);
        menu.destroy();
    }

    return { render, close, destroy };
}
