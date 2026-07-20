/* Overview view — the all-accounts-at-a-glance selection. Renders one compact
 * row per account, each showing that account's primary limit ("the 5h
 * window" when present, else the first percent entry, else the first entry
 * of any kind) with a clickable target that switches to that account's own
 * provider selection for full detail.
 *
 * Pure functions over a passed-in parent + ctx. The Indicator owns
 * _results; this module reads it through the ctx.results map. */

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import { clampPercent as clamp, pickPrimaryEntry } from '../domain/usage.js';
import { addProgressBar, addSeparator } from './entry-view/shared.js';
import { overviewRightText } from './overview-text.js';

/* Render one compact account row. Reads the account's latest fetch result
 * from results[account.id], selects the primary entry, and wires the click
 * to onSelectProvider(account.provider). */
export function addOverviewRow({ parent, account, provider, results,
                                   showLogos, displayMode, logoProvider,
                                   colorForPercent, onSelectProvider }) {
    const res = results[account.id];
    const picked = pickPrimaryEntry(res);

    const btn = new St.Button({
        style_class: 'ai-usage-overview-row',
        can_focus: true,
        x_expand: true,
    });
    const box = new St.BoxLayout({ vertical: true, x_expand: true });

    const top = new St.BoxLayout({ x_expand: true });
    const labelBox = new St.BoxLayout({
        x_expand: true, y_align: Clutter.ActorAlign.CENTER,
    });
    if (showLogos) {
        const logo = logoProvider(provider);
        if (logo) labelBox.add_child(logo);
    }
    labelBox.add_child(new St.Label({
        text: account.label || provider.name,
        style_class: 'ai-usage-overview-label',
        y_align: Clutter.ActorAlign.CENTER,
    }));
    top.add_child(labelBox);

    top.add_child(new St.Label({
        text: overviewRightText(picked, displayMode),
        style_class: 'ai-usage-usage-subtitle ai-usage-usage-subtitle-right',
        y_align: Clutter.ActorAlign.CENTER,
    }));
    box.add_child(top);

    if (picked.state === 'percent') {
        const pctUsed = clamp(picked.entry.percentUsed
            ?? (picked.entry.percentRemaining != null ? 100 - picked.entry.percentRemaining : 0));
        addProgressBar(box, pctUsed, colorForPercent(pctUsed));
    } else if (picked.state === 'error') {
        box.add_child(new St.Label({
            text: `Error: ${picked.message}`,
            style: 'color: #ff7800; font-size: 0.8em; margin-top: 2px;',
        }));
    }

    btn.set_child(box);
    btn.connect('clicked', () => {
        onSelectProvider(account.provider);
        return Clutter.EVENT_PROPAGATE;
    });
    parent.add_child(btn);
}

/* Render the overview: one row per account, separated by thin dividers.
 * The caller passes the parent (the content box) and a ctx carrying the
 * result map + presentation callbacks. */
export function renderOverview({ parent, accounts, results, showLogos,
                                   displayMode, logoProvider, colorForPercent,
                                   onSelectProvider }) {
    let first = true;
    for (const { account, provider } of accounts) {
        if (!first) addSeparator(parent);
        first = false;
        addOverviewRow({
            parent, account, provider, results,
            showLogos, displayMode, logoProvider,
            colorForPercent, onSelectProvider,
        });
    }
}
