/* Shared config store for provider accounts.
 *
 * All provider credentials live in a JSON file at:
 *   ${XDG_DATA_HOME}/.ai-usage-ext/config.json
 * (defaults to ~/.local/share/.ai-usage-ext/config.json)
 *
 * Both extension.js (shell side) and prefs.js (GTK side) import this module.
 */

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

const CONFIG_DIR = GLib.build_filenamev([GLib.get_user_data_dir(), '.ai-usage-ext']);
const CONFIG_PATH = GLib.build_filenamev([CONFIG_DIR, 'config.json']);

export class ConfigError extends Error {}

export function configPath() {
    return CONFIG_PATH;
}

export function defaultConfig() {
    return { version: 1, accounts: [] };
}

/* Generate a random account id like "acc_a1b2c3". */
export function genId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let s = '';
    for (let i = 0; i < 6; i++)
        s += chars[Math.floor(Math.random() * chars.length)];
    return `acc_${s}`;
}

/* Missing config is a valid first run; malformed config must remain visible.
 * The thrown message keeps the absolute path OUT — it ends up in the panel
 * and journal, and the username embedded in /home/<user>/... is not
 * something we want to surface to anyone reading the journal. */
export function load() {
    if (!GLib.file_test(CONFIG_PATH, GLib.FileTest.EXISTS))
        return defaultConfig();

    try {
        const [ok, contents] = GLib.file_get_contents(CONFIG_PATH);
        if (!ok || !contents)
            throw new Error('could not read config file');
        const text = new TextDecoder().decode(contents);
        const data = JSON.parse(text);
        if (!data || !Array.isArray(data.accounts))
            throw new Error('config must contain an accounts array');
        return data;
    } catch (e) {
        throw new ConfigError(`Invalid config: ${e.message || e}`);
    }
}

/* Atomically write config.json with mode 0600, creating the directory if
 * needed.
 *
 * Implementation note: GLib.file_set_contents creates the temp file with
 * umask perms (often 0644) and only a follow-up chmod would tighten it —
 * leaving credentials world-readable in a brief window on pre-existing
 * loose directories (NFS, shared /tmp layouts, restored-from-backup homes).
 * Gio.File.replace() with REPLACE_DESTINATION creates the file 0600 from
 * the start, which removes the race entirely. */
export function save(config) {
    if (!config || !Array.isArray(config.accounts)) {
        log('[ai-usage] config.save rejected invalid config');
        return false;
    }

    GLib.mkdir_with_parents(CONFIG_DIR, 0o700);
    const text = JSON.stringify(config, null, 2);
    const bytes = new TextEncoder().encode(text);

    const dest = Gio.File.new_for_path(CONFIG_PATH);
    let stream;
    try {
        // PRIVATE = create with mode 0600 from the start, no umask window.
        stream = dest.replace(null, false,
            Gio.FileCreateFlags.REPLACE_DESTINATION | Gio.FileCreateFlags.PRIVATE, null);
        stream.write_all(bytes, null);
        stream.close(null);
        return true;
    } catch (e) {
        log(`[ai-usage] config.save failed: ${e}`);
        try { if (stream) stream.close(null); } catch (_) {}
        return false;
    }
}
