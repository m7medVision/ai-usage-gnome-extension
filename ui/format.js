/* Presentation-only formatters and palette constants shared by the
 * popup renderers. Pure functions: no GSettings, no widgets, no I/O. */

/* Adwaita-derived palette. */
export const COLOR_GREEN = '#2ec27e';
export const COLOR_YELLOW = '#f6d32d';
export const COLOR_ORANGE = '#ff7800';
export const COLOR_RED = '#e01b24';
export const COLOR_MUTED = '#9ca3af';

/* Raw OpenCode Go cost units → dollars. Calibrated against the dashboard:
 * cost:374228 → $0.0037, divisor ≈ 101,142,703. */
const OCG_COST_DIVISOR = 101142703;

/* Parse #RRGGBB into [r, g, b, a] (0–1 floats) for Cairo. */
export function hexToRgba(hex) {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16) / 255;
    const g = parseInt(h.substring(2, 4), 16) / 255;
    const b = parseInt(h.substring(4, 6), 16) / 255;
    return [r, g, b, 1.0];
}

export function fmtNum(n) {
    if (n === null || n === undefined) return null;
    if (typeof n === 'number') {
        if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
        if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
        return String(Math.round(n));
    }
    return String(n);
}

export function fmtCost(rawCost) {
    const dollars = rawCost / OCG_COST_DIVISOR;
    if (dollars >= 100) return `$${dollars.toFixed(0)}`;
    if (dollars >= 1) return `$${dollars.toFixed(2)}`;
    return `$${dollars.toFixed(3)}`;
}

/* Format an ISO reset time as a compact "resets 5h 12m" countdown. */
export function fmtReset(iso) {
    if (!iso) return '';
    const d = new Date(iso) - Date.now();
    if (d <= 0) return 'resets soon';
    const m = Math.floor(d / 60000);
    if (m < 60) return `resets ${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `resets ${h}h ${m % 60}m`;
    return `resets ${Math.floor(h / 24)}d ${h % 24}h`;
}

/* Format milliseconds as a compact H:MM:SS or MM:SS countdown for the live
 * peak-status indicator. */
export function fmtHMS(ms) {
    if (ms === null || ms === undefined || ms <= 0) return 'now';
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = n => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}