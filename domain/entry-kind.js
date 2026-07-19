/* Discriminated-union contract for usage entries.
 *
 * Each provider emits a list of entries via its fetch(); the UI dispatches on
 * `entry.kind` to pick a renderer. Centralising the kind names here means
 * adding a new kind touches the dispatcher + one renderer, not three files
 * that each silently switch on the same string. */

export const EntryKind = Object.freeze({
    Percent: 'percent',
    BarChart: 'barchart',
    PeakBarChart: 'peakbarchart',
    StackedBarChart: 'stackedbarchart',
    CostDistribution: 'costdistribution',
    PeakStatus: 'peakstatus',
    Value: 'value',
});

/* All kinds the dispatcher must handle, in registration order. The renderer
 * (Strategy table) mirrors this list so a new kind missing a renderer fails
 * loudly instead of silently falling through to a default branch. */
export const ALL_ENTRY_KINDS = Object.values(EntryKind);

/* True when an entry carries a `percentUsed`/`percentRemaining` pair the
 * overview/panel can rank, as opposed to charts, balances, or peak lights. */
export function isPercentEntry(entry) {
    return !!entry && entry.kind === EntryKind.Percent;
}