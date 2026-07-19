/* Panel severity palette mapping. Pure function over the displayed
 * percentage and the GSettings thresholds so it can be unit-tested without
 * widgets. */
import { usageLevel } from '../domain/usage.js';
import { COLOR_GREEN, COLOR_YELLOW, COLOR_ORANGE, COLOR_RED, COLOR_MUTED } from './format.js';

const LEVEL_TO_COLOR = {
    unknown: COLOR_MUTED,
    low: COLOR_GREEN,
    medium: COLOR_YELLOW,
    high: COLOR_ORANGE,
    critical: COLOR_RED,
};

/* Map a percent-used value to its severity color via the user's thresholds.
 * `settings` is the live GSettings object read for high/critical — passing
 * explicit numbers here (instead of settings) would let this become pure,
 * but the only call sites already have settings in hand. */
export function colorForPercent(percentUsed, settings) {
    return LEVEL_TO_COLOR[usageLevel(
        percentUsed,
        settings.get_int('high-usage-threshold'),
        settings.get_int('critical-usage-threshold'),
    )];
}