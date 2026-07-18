/* Vertical bar chart (used for the rolling 24h usage, 7d peak-by-hour, and
 * OpenCode Go's rolling-50 model cost chart — providers pass per-bar colors
 * for the latter). One default color used when a bar omits its own. */

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import { hexToRgba } from '../format.js';
import { addTitle, addLegendFlow } from './shared.js';

const CHART_DEFAULT_COLOR = '#3584e4';

/* `legend` items are either {color, label} (peak) or {color, name, total,
 * unit} (model). Both flow through addLegendFlow's getText default. */
export function renderBarChart(parent, entry) {
    const bars = entry.bars || [];
    if (bars.length === 0) return;
    const maxVal = Math.max(...bars.map(b => b.value), 1);

    addTitle(parent, entry.label || 'Usage');

    const chart = new St.DrawingArea({
        style_class: 'ai-usage-barchart',
        x_expand: true,
    });
    const defaultColor = hexToRgba(CHART_DEFAULT_COLOR);
    chart.connect('repaint', area => {
        const cr = area.get_context();
        const w = area.width;
        const h = area.height;
        if (w <= 0 || h <= 0 || bars.length === 0) { cr.$dispose(); return; }

        const gap = 3;
        const barW = Math.max(2, (w - gap * (bars.length - 1)) / bars.length);

        for (let i = 0; i < bars.length; i++) {
            const fraction = bars[i].value / maxVal;
            const barH = bars[i].value > 0
                ? Math.max(1, Math.round((h - 14) * fraction))
                : 0;
            const x = i * (barW + gap);
            const y = h - 14 - barH;
            const rgba = bars[i].color ? hexToRgba(bars[i].color) : defaultColor;
            cr.setSourceRGBA(rgba[0], rgba[1], rgba[2], rgba[3]);
            if (barH > 0) {
                cr.rectangle(x, y, barW, barH);
                cr.fill();
            }
        }
        cr.$dispose();
    });
    parent.add_child(chart);

    const step = bars.length > 12 ? Math.ceil(bars.length / 6) : 1;
    const labelRow = new St.BoxLayout({ x_expand: true, style_class: 'ai-usage-barchart-labels' });
    for (let i = 0; i < bars.length; i++) {
        labelRow.add_child(new St.Label({
            text: (i % step === 0 || i === bars.length - 1) ? bars[i].label : '',
            style_class: 'ai-usage-barchart-label',
            x_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
        }));
    }
    parent.add_child(labelRow);

    if (entry.legend)
        addLegendFlow(parent, entry.legend, entry.unit);
}