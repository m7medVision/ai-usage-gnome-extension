/* Horizontal cost-distribution bar: a single track split into colored
 * segments, one per model. Segment width = that model's share of total cost
 * over the last N requests. Shows the cost mix at a glance. */

import St from 'gi://St';
import { hexToRgba, fmtCost } from '../format.js';
import { addTitle, addLegendFlow } from './shared.js';

export function renderCostDistribution(parent, entry) {
    const segments = entry.segments || [];
    if (segments.length === 0) return;
    const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;

    addTitle(parent, entry.label || 'Cost distribution');

    const bar = new St.DrawingArea({
        style_class: 'ai-usage-progress-bar ai-usage-cost-dist-bar',
        x_expand: true,
    });
    bar.connect('repaint', area => {
        const cr = area.get_context();
        const w = area.width;
        const h = area.height;
        if (w <= 0 || h <= 0) { cr.$dispose(); return; }

        let x = 0;
        for (const seg of segments) {
            const segW = Math.round(w * seg.value / total);
            if (segW <= 0) continue;
            const rgba = hexToRgba(seg.color);
            cr.setSourceRGBA(rgba[0], rgba[1], rgba[2], rgba[3]);
            cr.rectangle(x, 0, segW, h);
            cr.fill();
            x += segW;
        }
        cr.$dispose();
    });
    parent.add_child(bar);

    const stats = new St.BoxLayout({ x_expand: true });
    stats.add_child(new St.Label({
        text: `${segments.length} models`,
        style_class: 'ai-usage-usage-subtitle',
        x_expand: true,
    }));
    stats.add_child(new St.Label({
        text: `total ${fmtCost(entry.totalCost)}`,
        style_class: 'ai-usage-usage-subtitle ai-usage-usage-subtitle-right',
    }));
    parent.add_child(stats);

    addLegendFlow(parent, entry.legend, entry.unit);
}