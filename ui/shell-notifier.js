/* GNOME Shell adapter for application-level usage-alert events. */

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const ALERT_TITLE = 'AI Usage warning';

export function createShellNotifier() {
    return alert => {
        const percent = Math.round(alert.percentUsed);
        Main.notify(ALERT_TITLE,
            `${alert.accountLabel} — ${alert.entryLabel} reached ${percent}% used.`);
    };
}
