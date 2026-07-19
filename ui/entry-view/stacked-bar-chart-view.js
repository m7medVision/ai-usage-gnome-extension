/* Stacked bar chart: each bucket is a vertical bar split into colored
 * segments — one per model. A legend row shows each model's color swatch and
 * its total tokens for the window. Used for Z.AI model usage. */

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import { hexToRgba } from '../format.js';
import { addTitle, addLegendFlow } from './shared.js';

export function renderStackedBarChart(parent, entry) {
    const buckets = entry.buckets || [];
    if (buckets.length === 0) return;
    const legend = entry.legend || [];

    const bucketTotals = buckets.map(b =>
        b.segments.reduce((s, seg) => s + seg.value, 0));
    const maxTotal = Math.max(...bucketTotals, 1);

    addTitle(parent, entry.label || 'Model usage');

    const chart = new St.DrawingArea({
        style_class: 'ai-usage-barchart ai-usage-stacked-barchart',
        x_expand: true,
    });
    chart.connect('repaint', area => {
        const cr = area.get_context();
        const w = area.width;
        const h = area.height;
        if (w <= 0 || h <= 0 || buckets.length === 0) { cr.$dispose(); return; }

        const gap = 2;
        const barW = Math.max(2, (w - gap * (buckets.length - 1)) / buckets.length);
        const chartH = h - 16;

        for (let i = 0; i < buckets.length; i++) {
            const total = bucketTotals[i];
            if (total <= 0) continue;
            const scale = chartH / maxTotal;
            const x = i * (barW + gap);
            let y = chartH;
            for (const seg of buckets[i].segments) {
                if (seg.value <= 0) continue;
                const segH = Math.max(1, Math.round(seg.value * scale));
                y -= segH;
                const rgba = hexToRgba(seg.color);
                cr.setSourceRGBA(rgba[0], rgba[1], rgba[2], rgba[3]);
                cr.rectangle(x, y, barW, segH);
                cr.fill();
            }
        }
        cr.$dispose();
    });
    parent.add_child(chart);

    const step = buckets.length > 12 ? Math.ceil(buckets.length / 6) : 1;
    const labelRow = new St.BoxLayout({ x_expand: true, style_class: 'ai-usage-barchart-labels' });
    for (let i = 0; i < buckets.length; i++) {
        labelRow.add_child(new St.Label({
            text: (i % step === 0 || i === buckets.length - 1) ? buckets[i].label : '',
            style_class: 'ai-usage-barchart-label',
            x_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
        }));
    }
    parent.add_child(labelRow);

    if (legend.length > 0)
        addLegendFlow(parent, legend, entry.unit);
}