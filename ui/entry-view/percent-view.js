/* Percent renderer: a horizontal progress bar + used/remaining stats +
 * optional per-tool breakdown. Pulls the displayed polarity (used vs.
 * remaining) from ctx.displayMode so the view stays pure over presentation
 * data and does not import GSettings itself. */

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import { fmtNum, fmtReset, COLOR_MUTED } from '../format.js';
import { addTitle, addProgressBar } from './shared.js';

const clamp = v => Math.max(0, Math.min(100, v));

export function renderPercent(parent, entry, ctx) {
    const pctUsed = clamp(entry.percentUsed ?? (entry.percentRemaining != null
        ? 100 - entry.percentRemaining : 0));
    const pctRemaining = clamp(100 - pctUsed);
    addTitle(parent, entry.label || 'Usage');
    addProgressBar(parent, pctUsed, ctx.colorForPercent(pctUsed));

    const stats = new St.BoxLayout({ x_expand: true });
    const leftText = ctx.displayMode === 'remaining'
        ? `${Math.round(pctRemaining)}% left`
        : `${Math.round(pctUsed)}% used`;
    stats.add_child(new St.Label({
        text: leftText,
        style_class: 'ai-usage-usage-subtitle',
        x_expand: true,
    }));
    const detail = [];
    if (entry.remaining) detail.push(`${fmtNum(entry.remaining)} rem`);
    if (entry.resetTimeIso) detail.push(fmtReset(entry.resetTimeIso));
    if (detail.length)
        stats.add_child(new St.Label({
            text: detail.join(', '),
            style_class: 'ai-usage-usage-subtitle ai-usage-usage-subtitle-right',
        }));
    parent.add_child(stats);

    if (entry.breakdown) renderBreakdown(parent, entry.breakdown, ctx);
}

/* MCP per-tool breakdown: one thin labelled bar per tool, fill = the tool's
 * share of total MCP calls used this window. Empty window → all bars render
 * as an empty track (no division by zero). */
function renderBreakdown(parent, breakdown, ctx) {
    const total = breakdown.total || 0;
    const items = breakdown.items || [];
    if (items.length === 0) return;

    const header = new St.BoxLayout({ x_expand: true, style_class: 'ai-usage-breakdown-header' });
    header.add_child(new St.Label({
        text: 'MCP tools',
        style_class: 'ai-usage-breakdown-title',
        x_expand: true,
    }));
    header.add_child(new St.Label({
        text: total > 0 ? `${fmtNum(total)} used` : 'none used yet',
        style_class: 'ai-usage-usage-subtitle ai-usage-usage-subtitle-right',
    }));
    parent.add_child(header);

    for (const item of items) {
        const row = new St.BoxLayout({
            style_class: 'ai-usage-breakdown-row',
            x_expand: true,
        });
        row.add_child(new St.Label({
            text: item.label,
            style_class: 'ai-usage-breakdown-label',
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        }));

        const barBox = new St.BoxLayout({
            style_class: 'ai-usage-breakdown-bar-box',
            x_expand: true,
        });
        const pctShare = total > 0 ? (item.value / total) * 100 : 0;
        addProgressBar(barBox, pctShare, COLOR_MUTED);
        row.add_child(barBox);

        row.add_child(new St.Label({
            text: total > 0
                ? `${fmtNum(item.value)} (${Math.round(pctShare)}%)`
                : `${fmtNum(item.value)}`,
            style_class: 'ai-usage-breakdown-count',
            y_align: Clutter.ActorAlign.CENTER,
        }));
        parent.add_child(row);
    }
}
