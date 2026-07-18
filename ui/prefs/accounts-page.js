import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import { gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { buildAccountRow } from './account-row.js';
import { showAddAccountDialog } from './add-account-dialog.js';
import { autoDetectAccounts } from './auto-detect.js';

export class AccountsPage {
    #window;
    #repository;
    #page;
    #accountsGroup;
    #onStartZaiOAuth;
    #onLogoutZaiOAuth;

    constructor({ window, repository, onStartZaiOAuth, onLogoutZaiOAuth }) {
        this.#window = window;
        this.#repository = repository;
        this.#onStartZaiOAuth = onStartZaiOAuth;
        this.#onLogoutZaiOAuth = onLogoutZaiOAuth;
        this.#page = new Adw.PreferencesPage({
            title: _('Accounts'),
            icon_name: 'preferences-system-symbolic',
        });
        window.add(this.#page);
        this.#accountsGroup = this.#newAccountsGroup();
        this.#page.add(this.#accountsGroup);
        this.render();
        this.#buildActions();
    }

    render() {
        this.#page.remove(this.#accountsGroup);
        this.#accountsGroup = this.#newAccountsGroup();
        this.#page.insert(this.#accountsGroup, 0);

        const value = this.#repository.load({ showError: false });
        if (!value) {
            this.#accountsGroup.description = _(
                'Configuration is invalid. Fix or restore config.json before editing accounts.');
            return;
        }
        for (const account of value.accounts) {
            this.#accountsGroup.add(buildAccountRow({
                account,
                onUpdate: (id, mutate) => this.#repository.update(id, mutate),
                onRemove: id => {
                    if (this.#repository.remove(id)) this.render();
                },
                onStartZaiOAuth: this.#onStartZaiOAuth,
                onLogoutZaiOAuth: this.#onLogoutZaiOAuth,
            }));
        }
    }

    #newAccountsGroup() {
        return new Adw.PreferencesGroup({
            title: _('Configured Accounts'),
            description: _('Each account fetches usage independently.'),
        });
    }

    #buildActions() {
        const group = new Adw.PreferencesGroup();
        this.#page.add(group);
        group.add(actionRow({
            title: _('Add Account'),
            subtitle: _('Choose a provider and create a new account.'),
            label: _('Add'),
            suggested: true,
            onClick: () => showAddAccountDialog({
                window: this.#window,
                onAdd: (provider, label) => {
                    if (this.#repository.add(provider, label)) this.render();
                },
            }),
        }));
        group.add(actionRow({
            title: _('Auto-detect accounts'),
            subtitle: _('Scan ~/.claude and ~/.local/share/opencode for local CLI logins.'),
            label: _('Scan'),
            onClick: () => autoDetectAccounts({
                window: this.#window,
                repository: this.#repository,
                onChanged: () => this.render(),
            }),
        }));
    }
}

function actionRow({ title, subtitle, label, suggested = false, onClick }) {
    const row = new Adw.ActionRow({ title, subtitle });
    const button = new Gtk.Button({
        label,
        css_classes: suggested ? ['suggested-action'] : [],
        valign: Gtk.Align.CENTER,
    });
    button.connect('clicked', onClick);
    row.add_suffix(button);
    row.set_activatable_widget(button);
    return row;
}
