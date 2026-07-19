/* Entry Strategy dispatcher — `addEntry(parent, entry, ctx)` selects a
 * renderer by `entry.kind`. To add a new entry kind: author a new
 * *-view.js module under this folder and add one line to the RENDERERS
 * table. No `if/else` ladder in callers — OCP: extension over modification.
 *
 * `ctx` carries presentation intent renderers need: colorForPercent(pct)
 * (severity color via settings), displayMode ('used' | 'remaining'), and
 * onPeakTick(fn) (registers a per-second update while the menu is open). */

import { EntryKind } from '../../domain/entry-kind.js';
import { renderPercent } from './percent-view.js';
import { renderBarChart } from './bar-chart-view.js';
import { renderStackedBarChart } from './stacked-bar-chart-view.js';
import { renderCostDistribution } from './cost-distribution-view.js';
import { renderPeakStatus } from './peak-status-view.js';
import { renderValueBox } from './value-box-view.js';

const RENDERERS = {
    [EntryKind.Percent]: renderPercent,
    [EntryKind.BarChart]: renderBarChart,
    [EntryKind.PeakBarChart]: renderBarChart,
    [EntryKind.StackedBarChart]: renderStackedBarChart,
    [EntryKind.CostDistribution]: renderCostDistribution,
    [EntryKind.PeakStatus]: renderPeakStatus,
    [EntryKind.Value]: renderValueBox,
};

export function addEntry(parent, entry, ctx) {
    const render = RENDERERS[entry.kind];
    if (!render)
        throw new Error(`No renderer registered for entry kind: ${entry.kind}`);
    render(parent, entry, ctx);
}