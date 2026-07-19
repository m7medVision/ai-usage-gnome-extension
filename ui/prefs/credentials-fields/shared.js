import Adw from 'gi://Adw';

export function addCredentialField(row, account, title, key, hidden, context) {
    const entry = new Adw.EntryRow({ title });
    entry.set_text(account.credentials?.[key] || '');
    entry.set_show_apply_button(true);
    if (hidden) entry.visibility = false;
    entry.connect('apply', () => {
        const value = entry.get_text().trim();
        context.onUpdate(account.id, changed => {
            changed.credentials[key] = value;
        });
    });
    row.add_row(entry);
}
