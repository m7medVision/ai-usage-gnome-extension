/* Peak-hours traffic-light: a colored circle (red = currently peak, green =
 * off-peak) + a live countdown to the next state change. The countdown is
 * recomputed every 1s while the menu is open via a dedicated ticker that
 * touches only these widgets — it does not refetch or re-render the menu.
 *
 * The per-second update closure is registered with the ticker through
 * ctx.onPeakTick(fn) so the renderer does not own the lifecycle. */

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import { currentPeakStatus } from '../../domain/peak.js';
import { fmtHMS, COLOR_RED, COLOR_GREEN, COLOR_MUTED, hexToRgba } from '../format.js';

export function renderPeakStatus(parent, entry, ctx) {
    const row = new St.BoxLayout({
        style_class: 'ai-usage-peak-status',
        x_expand: true,
    });

    const dot = new St.DrawingArea({
        style_class: 'ai-usage-peak-dot',
    });
    row.add_child(dot);

    const text = new St.Label({
        style_class: 'ai-usage-peak-text',
        x_expand: true,
        y_align: Clutter.ActorAlign.CENTER,
    });
    row.add_child(text);
    parent.add_child(row);

    const update = () => {
        const s = currentPeakStatus(new Date(), entry.peakWindows);
        const color = s.inPeak ? COLOR_RED : COLOR_GREEN;
        const label = s.inPeak ? 'Peak (surcharge)' : 'Off-peak';
        const next = s.inPeak ? 'peak ends in' : 'peak starts in';
        text.set_text(`${label} · ${next} ${fmtHMS(s.msToChange)}`);
        dot.repaint && dot.repaint();
        dot._peakColor = color;
    };

    dot.connect('repaint', area => {
        const cr = area.get_context();
        const w = area.width;
        const h = area.height;
        if (w <= 0 || h <= 0) { cr.$dispose(); return; }
        const rgba = hexToRgba(area._peakColor || COLOR_MUTED);
        cr.setSourceRGBA(rgba[0], rgba[1], rgba[2], rgba[3]);
        cr.arc(w / 2, h / 2, Math.min(w, h) / 2 - 1, 0, 2 * Math.PI);
        cr.fill();
        cr.$dispose();
    });

    update();
    ctx.onPeakTick(update);
}