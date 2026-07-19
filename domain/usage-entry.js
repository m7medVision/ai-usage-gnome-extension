/* UsageEntry value object — the shape of one row in a provider's fetch
 * result. Dispatching on `entry.kind` selects the renderer in ui/entry-view/. */
// ponytail: thin value object; no invariant to protect beyond shape + kind.

import { EntryKind } from './entry-kind.js';

/**
 * @typedef {Object} UsageEntry
 * @property {string} kind          - one of EntryKind
 * @property {string} [name]       - internal name
 * @property {string} [group]      - grouping label for the rendered section
 * @property {string} [label]      - displayed label
 */

export function createEntry(kind, rest = {}) {
    if (!Object.values(EntryKind).includes(kind))
        throw new Error(`Unknown entry kind: ${kind}`);
    return { kind, ...rest };
}