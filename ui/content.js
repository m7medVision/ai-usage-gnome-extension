/* Content view — dispatches the active tab's body into the popup content
 * area. Reads the config error, account set, result map, and active tab id
 * from ctx; delegates per-account bodies to renderOverview (for the
 * synthetic overview tab) or addEntry (for a single account's fetch
 * results). Pure dispatcher — no widget construction beyond what the
 * shared helpers provide. */

import { OVERVIEW_ID } from './tabs.js';
import { renderOverview } from './overview.js';
import { addEntry } from './entry-view/index.js';
import { addHint, addError, addSeparator } from './entry-view/shared.js';

/* Render the content area for the currently active tab.
 *
 * ctx fields:
 *   parent            - St.BoxLayout to render into (must already be empty)
 *   accounts          - [{ account, provider }] from AccountRepository
 *   results           - Map account.id → UsageResult (latest fetch)
 *   activeAccountId   - account id currently selected, or OVERVIEW_ID
 *   configError       - lastError from AccountRepository (null when healthy)
 *   ctx               - the entry-renderer context (displayMode,
 *                       colorForPercent, onPeakTick) passed through to
 *                       addEntry / renderOverview
 *   onSelectAccount   - called when the user clicks an overview row
 *   onPeakTick        - registered per-second update callbacks
 *
 * Returns the list of peak-tick callbacks registered during this render
 * (the Indicator assigns them to _peakWidgets). */
export function renderContent({ parent, accounts, results, activeAccountId,
                                 configError, ctx, onSelectAccount }) {
    if (configError) {
        addError(parent, configError);
        return;
    }

    if (activeAccountId === OVERVIEW_ID) {
        renderOverview({
            parent, accounts, results,
            showLogos: ctx.showLogos,
            displayMode: ctx.displayMode,
            logoProvider: ctx.logoProvider,
            colorForPercent: ctx.colorForPercent,
            onSelectAccount,
        });
        return;
    }

    const active = accounts.find(a => a.account.id === activeAccountId);
    if (!active) {
        addHint(parent, 'Configure accounts in Preferences…');
        return;
    }

    const res = results[active.account.id];
    if (!res || !res.attempted) {
        addHint(parent, 'No data yet — refresh to fetch.');
        return;
    }

    if (!res.entries || res.entries.length === 0) {
        if (res.errors && res.errors.length) {
            for (const err of res.errors)
                addError(parent, err);
        } else {
            addHint(parent, 'No usage data. Configure this account in Preferences…');
        }
        return;
    }

    let first = true;
    for (const e of res.entries) {
        if (!first) addSeparator(parent);
        first = false;
        addEntry(parent, e, ctx);
    }

    if (res.errors && res.errors.length) {
        addSeparator(parent);
        for (const err of res.errors)
            addError(parent, err);
    }
}
