import { gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { addCredentialField } from './shared.js';

export function renderDeepseekFields(row, account, context) {
    addCredentialField(row, account, _('API Key'), 'apiKey', true, context);
}
