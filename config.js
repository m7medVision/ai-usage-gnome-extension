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

/* Missing config is a valid first run; malformed config must remain visible. */
export function load() {
    if (!GLib.file_test(CONFIG_PATH, GLib.FileTest.EXISTS))
        return defaultConfig();

    try {
        const [ok, contents] = GLib.file_get_contents(CONFIG_PATH);
        if (!ok || !contents)
            throw new Error('Could not read config file');
        const text = new TextDecoder().decode(contents);
        const data = JSON.parse(text);
        if (!data || !Array.isArray(data.accounts))
            throw new Error('Config must contain an accounts array');
        return data;
    } catch (e) {
        throw new ConfigError(`Invalid config at ${CONFIG_PATH}: ${e.message || e}`);
    }
}

/* Atomically write config.json, creating the directory if needed. */
export function save(config) {
    if (!config || !Array.isArray(config.accounts)) {
        log('[ai-usage] config.save rejected invalid config');
        return false;
    }

    const tmpPath = `${CONFIG_PATH}.tmp`;
    try {
        GLib.mkdir_with_parents(CONFIG_DIR, 0o700);
        const text = JSON.stringify(config, null, 2);
        const bytes = new TextEncoder().encode(text);

        // Atomic write: write to temp file, then replace the target.
        GLib.file_set_contents(tmpPath, bytes);
        if (GLib.chmod(tmpPath, 0o600) !== 0)
            throw new Error('Could not secure temporary config file');
        const tmp = Gio.File.new_for_path(tmpPath);
        const dest = Gio.File.new_for_path(CONFIG_PATH);
        tmp.move(dest, Gio.FileCopyFlags.OVERWRITE, null, null);
        return true;
    } catch (e) {
        try { GLib.unlink(tmpPath); } catch (_) {}
        log(`[ai-usage] config.save failed: ${e}`);
        return false;
    }
}
