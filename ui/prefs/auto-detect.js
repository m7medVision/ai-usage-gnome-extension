import Adw from 'gi://Adw';
import { gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { scanLocalAuthSources } from '../../local-detect.js';
import { createDefaultCredentials } from '../../providers/index.js';
import { importDetectedAccounts } from './account-detection.js';

export function autoDetectAccounts({ window, repository, onChanged }) {
    const found = scanLocalAuthSources();
    const value = repository.load();
    if (!value) return;

    const imported = importDetectedAccounts(value.accounts, found, {
        createId: () => repository.createId(),
        createDefaultCredentials,
    });
    value.accounts = imported.accounts;

    if (imported.added.length > 0 && !repository.save(value))
        return;
    onChanged();
    showSummary(window, imported.added, imported.skipped);
}

function showSummary(window, added, skipped) {
    let body;
    if (added.length === 0 && skipped.length === 0) {
        body = _('No local CLI credentials found (~/.claude, ~/.local/share/opencode).');
    } else {
        const lines = [];
        if (added.length > 0)
            lines.push(_(`Added: ${added.join(', ')}`));
        if (skipped.length > 0)
            lines.push(_(`Already configured (skipped): ${skipped.join(', ')}`));
        body = lines.join('\n');
    }

    const dialog = new Adw.MessageDialog({
        heading: _('Auto-detect accounts'),
        body,
        transient_for: window,
    });
    dialog.add_response('ok', _('OK'));
    dialog.present();
}
