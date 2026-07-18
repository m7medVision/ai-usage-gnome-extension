import St from 'gi://St';

import { COLOR_MUTED } from './format.js';
import { colorForPercent } from './usage-color.js';

export function createPanelIcon() {
    return new St.Icon({
        icon_name: 'stopwatch-symbolic',
        style_class: 'ai-usage-panel-icon',
    });
}

export function updatePanelIcon(icon, percentUsed, settings) {
    const color = percentUsed === null
        ? COLOR_MUTED
        : colorForPercent(percentUsed, settings);
    icon.set_style(`color: ${color};`);
}
