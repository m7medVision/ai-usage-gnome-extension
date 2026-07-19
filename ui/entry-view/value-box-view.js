/* Highlighted value box (e.g. DeepSeek balance): a rounded card with the
 * label above and the value emphasized inside. Negative balances render in
 * red, positive in green, neutral values use the default foreground. */

import St from 'gi://St';
import { addTitle } from './shared.js';

export function renderValueBox(parent, entry) {
    addTitle(parent, entry.label || 'Value');
    const raw = entry.value ?? '?';
    const numMatch = String(raw).match(/-?\d/);
    const isNeg = numMatch && numMatch[0] === '-';
    const box = new St.Label({
        text: raw,
        style_class: 'ai-usage-value-box' + (isNeg ? ' ai-usage-value-box-negative' : ''),
        x_expand: true,
    });
    parent.add_child(box);
}