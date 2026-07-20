/* Content view — dispatches the active provider's body into the popup content
 * area. Reads the config error, account set, result map, and active selection
 * from ctx; delegates per-account bodies to renderOverview (for the
 * synthetic overview selection) or addEntry (for each selected account's fetch
 * results). Pure dispatcher — no widget construction beyond what the
 * shared helpers provide. */

import { OVERVIEW_ID, selectedProviderAccounts } from './provider-filter.js';
import { renderOverview } from './overview.js';
import { addEntry } from './entry-view/index.js';
import { addHint, addError, addSeparator, addTitle } from './entry-view/shared.js';

/* Render the content area for the currently active provider selection.
 *
 * ctx fields:
 *   parent            - St.BoxLayout to render into (must already be empty)
 *   accounts          - [{ account, provider }] from AccountRepository
 *   results           - Map account.id → UsageResult (latest fetch)
 *   activeProviderId  - provider id currently selected, or OVERVIEW_ID
 *   configError       - lastError from AccountRepository (null when healthy)
 *   ctx               - the entry-renderer context (displayMode,
 *                       colorForPercent, onPeakTick) passed through to
 *                       addEntry / renderOverview
 *   onSelectProvider  - called when the user clicks an overview row
 *   onPeakTick        - registered per-second update callbacks
 *
 * Returns the list of peak-tick callbacks registered during this render
 * (the Indicator assigns them to _peakWidgets). */
export function renderContent({ parent, accounts, results, activeProviderId,
                                  configError, ctx, onSelectProvider }) {
    if (configError) {
        addError(parent, configError);
        return;
    }

    if (activeProviderId === OVERVIEW_ID) {
        renderOverview({
            parent, accounts, results,
            showLogos: ctx.showLogos,
            displayMode: ctx.displayMode,
            logoProvider: ctx.logoProvider,
            colorForPercent: ctx.colorForPercent,
            onSelectProvider,
        });
        return;
    }

    const activeAccounts = selectedProviderAccounts(accounts, activeProviderId);
    if (activeAccounts.length === 0) {
        addHint(parent, 'Configure accounts in Preferences…');
        return;
    }

    const showAccountTitles = activeAccounts.length > 1;
    let first = true;
    for (const { account, provider } of activeAccounts) {
        if (!first) addSeparator(parent);
        first = false;
        renderAccount({
            parent, account, provider, results, ctx, showAccountTitles,
        });
    }
}

function renderAccount({ parent, account, provider, results, ctx, showAccountTitles }) {
    if (showAccountTitles)
        addTitle(parent, account.label || provider.name);

    const res = results[account.id];
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
