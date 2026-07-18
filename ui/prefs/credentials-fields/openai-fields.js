import { gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { addCredentialField } from './shared.js';

export function renderOpenaiFields(row, account, context) {
    addCredentialField(row, account,
        _('OAuth Access Token'), 'oauthToken', true, context);
    addCredentialField(row, account,
        _('Refresh Token (optional)'), 'oauthRefresh', true, context);
}
