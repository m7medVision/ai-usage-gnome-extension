import Adw from 'gi://Adw';
import { gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { addCredentialField } from './shared.js';

export function renderClaudeCodeFields(row, account, context) {
    if (account.credentials?.autoDetect) {
        row.add_row(new Adw.ActionRow({
            title: _('Source'),
            subtitle: _('Auto-detected from ~/.claude/.credentials.json'),
        }));
        return;
    }
    addCredentialField(row, account,
        _('OAuth Access Token'), 'oauthToken', true, context);
}
