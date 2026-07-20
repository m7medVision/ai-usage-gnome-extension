/* Cache-backed alert ledger. It contains no credentials and exists only to
 * prevent duplicate desktop alerts across GNOME Shell restarts. */

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import { emptyAlertState } from '../domain/usage-alert-policy.js';

const CACHE_DIR = GLib.build_filenamev([GLib.get_user_cache_dir(), 'ai-usage-ext']);
const STATE_PATH = GLib.build_filenamev([CACHE_DIR, 'usage-alert-state.json']);

export function createAlertStateStore({ logger }) {
    return {
        load() {
            if (!GLib.file_test(STATE_PATH, GLib.FileTest.EXISTS))
                return emptyAlertState();

            try {
                const [ok, contents] = GLib.file_get_contents(STATE_PATH);
                if (!ok || !contents)
                    throw new Error('could not read alert state');
                const state = JSON.parse(new TextDecoder().decode(contents));
                return validState(state) ? state : emptyAlertState();
            } catch (error) {
                logger(`[ai-usage] could not load alert state: ${error}`);
                return emptyAlertState();
            }
        },

        save(state) {
            if (!validState(state)) {
                logger('[ai-usage] refused to save invalid alert state');
                return false;
            }

            let stream;
            try {
                GLib.mkdir_with_parents(CACHE_DIR, 0o700);
                stream = Gio.File.new_for_path(STATE_PATH).replace(null, false,
                    Gio.FileCreateFlags.REPLACE_DESTINATION | Gio.FileCreateFlags.PRIVATE, null);
                stream.write_all(new TextEncoder().encode(JSON.stringify(state)), null);
                stream.close(null);
                return true;
            } catch (error) {
                logger(`[ai-usage] could not save alert state: ${error}`);
                try { stream?.close(null); } catch (closeError) {
                    logger(`[ai-usage] could not close alert state: ${closeError}`);
                }
                return false;
            }
        },
    };
}

function validState(value) {
    return !!value && value.version === 1 && value.entries &&
        typeof value.entries === 'object' && !Array.isArray(value.entries);
}
