import { gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { addCredentialField } from './shared.js';

export function renderOpencodeGoFields(row, account, context) {
    addCredentialField(row, account, _('Workspace ID'), 'workspaceId', false, context);
    addCredentialField(row, account, _('Auth Cookie'), 'authCookie', true, context);
    addCredentialField(row, account,
        _('Server ID (x-server-id)'), 'serverId', false, context);
}
