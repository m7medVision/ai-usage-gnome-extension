import GLib from 'gi://GLib';

export function createPeakTicker(getWidgets) {
    let sourceId = 0;

    return {
        start() {
            if (sourceId) return;
            sourceId = GLib.timeout_add_seconds(
                GLib.PRIORITY_DEFAULT, 1, () => {
                    for (const update of getWidgets() ?? []) {
                        try { update(); } catch (e) { log(`[ai-usage] peak tick: ${e}`); }
                    }
                    return GLib.SOURCE_CONTINUE;
                });
        },

        stop() {
            if (!sourceId) return;
            GLib.source_remove(sourceId);
            sourceId = 0;
        },
    };
}
