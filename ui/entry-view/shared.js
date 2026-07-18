/* Shared Cairo + St widget helpers used by more than one entry renderer.
 * Kept stateless — renderers pass parent + entry, helpers build into parent
 * and return any widget the caller needs to inspect (e.g. the bar). */

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import { hexToRgba, fmtNum, fmtCost } from '../format.js';

export function addTitle(parent, text) {
    parent.add_child(new St.Label({
        text,
        style_class: 'ai-usage-usage-title',
    }));
}

export function addHint(parent, text) {
    parent.add_child(new St.Label({
        text,
        style_class: 'ai-usage-usage-subtitle ai-usage-hint',
    }));
}

export function addError(parent, text) {
    parent.add_child(new St.Label({
        text: `Error: ${text}`,
        style: 'color: #ff7800; font-weight: bold; margin-top: 4px;',
    }));
}

export function addSeparator(parent) {
    parent.add_child(new St.Widget({
        style: 'height: 1px; background-color: rgba(255,255,255,0.05); margin: 8px 0;',
    }));
}

/* Paint a rounded-rectangle subpath covering the full widget area. */
export function roundedPath(cr, w, h, radius) {
    cr.newSubPath();
    cr.arc(w - radius, radius, radius, -Math.PI / 2, 0);
    cr.arc(w - radius, h - radius, radius, 0, Math.PI / 2);
    cr.arc(radius, h - radius, radius, Math.PI / 2, Math.PI);
    cr.arc(radius, radius, radius, Math.PI, 3 * Math.PI / 2);
    cr.closePath();
}

/* Horizontal progress bar drawn with Cairo. pctUsed / pctRemaining are 0–100.
 * `fillColor` overrides the auto-derived severity color (used by the MCP
 * breakdown where segments share a neutral grey). */
export function addProgressBar(parent, pctUsed, fillColor) {
    const fraction = Math.max(0, Math.min(100, pctUsed)) / 100;

    const bar = new St.DrawingArea({
        style_class: 'ai-usage-progress-bar',
        x_expand: true,
    });
    bar.connect('repaint', area => {
        const cr = area.get_context();
        const w = area.width;
        const h = area.height;
        if (w <= 0 || h <= 0) { cr.$dispose(); return; }
        const radius = Math.min(h / 2, 6);

        cr.setSourceRGBA(1, 1, 1, 0.1);
        roundedPath(cr, w, h, radius);
        cr.fill();

        if (fraction > 0) {
            const fillW = Math.round(w * fraction);
            const rgba = hexToRgba(fillColor);
            cr.setSourceRGBA(rgba[0], rgba[1], rgba[2], rgba[3]);
            cr.save();
            roundedPath(cr, w, h, radius);
            cr.clip();
            cr.rectangle(0, 0, fillW, h);
            cr.fill();
            cr.restore();
        }
        cr.$dispose();
    });
    parent.add_child(bar);
    return bar;
}

/* Build the text for a legend entry, accounting for unit. Peak legends
 * pass {color, label}; model legends pass {color, name, total}. */
function legendLabel(item, unit) {
    if (item.label != null) return item.label;
    if (item.total === null || item.total === undefined) return item.name;
    if (unit === 'cost') return `${item.name} ${fmtCost(item.total)}`;
    return `${item.name} ${fmtNum(item.total)}`;
}

/* Render a legend as a wrapping flow layout: items are packed into rows of
 * at most `perRow` swatch+label pairs, then rows stack vertically. Keeps the
 * popup width bounded when there are many models (OpenCode Go workspaces
 * can expose 15+). */
export function addLegendFlow(parent, items, unit = null, { perRow = 4 } = {}) {
    if (!items || items.length === 0) return;
    const container = new St.BoxLayout({
        style_class: 'ai-usage-legend-flow',
        vertical: true,
        x_expand: true,
    });
    for (let i = 0; i < items.length; i += perRow) {
        const row = new St.BoxLayout({
            style_class: 'ai-usage-legend-row',
            x_expand: true,
        });
        for (let j = i; j < Math.min(i + perRow, items.length); j++) {
            const item = items[j];
            row.add_child(legendSwatch(item.color));
            row.add_child(new St.Label({
                text: legendLabel(item, unit),
                style_class: 'ai-usage-legend-label',
                y_align: Clutter.ActorAlign.CENTER,
            }));
        }
        container.add_child(row);
    }
    parent.add_child(container);
}

/* A 10x10 Cairo-filled square colored to match the model segment. */
export function legendSwatch(color) {
    const swatch = new St.DrawingArea({
        style_class: 'ai-usage-legend-swatch',
    });
    swatch.connect('repaint', area => {
        const cr = area.get_context();
        const w = area.width;
        const h = area.height;
        if (w <= 0 || h <= 0) { cr.$dispose(); return; }
        const rgba = hexToRgba(color);
        cr.setSourceRGBA(rgba[0], rgba[1], rgba[2], rgba[3]);
        cr.rectangle(0, 0, w, h);
        cr.fill();
        cr.$dispose();
    });
    return swatch;
}