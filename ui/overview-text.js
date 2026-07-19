/* Pure presentation helper for the overview tab: converts a picked primary
 * entry into the right-aligned summary string ("5h · 17% used", "No data
 * yet", etc.). Separated from ui/overview.js because that module imports
 * gi://St, which is unavailable outside the GNOME Shell process — keeping
 * this pure lets the full state matrix be unit-tested under plain GJS. */

import { clampPercent as clamp } from '../domain/usage.js';

export function overviewRightText(picked, displayMode) {
    if (picked.state === 'percent') {
        const e = picked.entry;
        const pctUsed = clamp(e.percentUsed ?? (e.percentRemaining != null ? 100 - e.percentRemaining : 0));
        const pctRemaining = clamp(100 - pctUsed);
        const label = (e.label || '').replace(/:$/, '');
        const pctText = displayMode === 'remaining'
            ? `${Math.round(pctRemaining)}% left`
            : `${Math.round(pctUsed)}% used`;
        return label ? `${label} · ${pctText}` : pctText;
    }
    if (picked.state === 'other') {
        const e = picked.entry;
        return e.value != null ? String(e.value) : (e.label || '—');
    }
    if (picked.state === 'not-configured') return 'Not configured';
    if (picked.state === 'no-data') return 'No data yet';
    if (picked.state === 'empty') return 'No usage data';
    if (picked.state === 'error') return 'Error';
    return '—';
}
