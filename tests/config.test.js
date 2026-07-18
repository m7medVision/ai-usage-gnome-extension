import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

import * as config from '../config.js';

function assertThrows(fn, expectedType, message) {
    try {
        fn();
    } catch (error) {
        if (error instanceof expectedType)
            return;
        throw error;
    }
    throw new Error(`${message}: expected an exception`);
}

// Arrange
const dataDir = GLib.get_user_data_dir();
if (!dataDir.startsWith('/tmp/'))
    throw new Error('Run config.test.js with a temporary XDG_DATA_HOME');
GLib.mkdir_with_parents(GLib.path_get_dirname(config.configPath()), 0o700);
GLib.file_set_contents(config.configPath(), new TextEncoder().encode('{invalid'));

// Act and assert
assertThrows(() => config.load(), config.ConfigError,
    'malformed config must not look like an empty account list');

// Arrange
const validConfig = { version: 1, accounts: [] };

// Act
const saved = config.save(validConfig);

// Assert
if (!saved)
    throw new Error('valid config should save');
if (GLib.file_test(`${config.configPath()}~`, GLib.FileTest.EXISTS))
    throw new Error('credential backups must not remain on disk');
const mode = Gio.File.new_for_path(config.configPath())
    .query_info('unix::mode', Gio.FileQueryInfoFlags.NONE, null)
    .get_attribute_uint32('unix::mode') & 0o777;
if (mode !== 0o600)
    throw new Error(`config permissions: expected 600, got ${mode.toString(8)}`);

// load() must reject valid JSON with the wrong shape, not silently default.
// Arrange
GLib.file_set_contents(config.configPath(), new TextEncoder().encode('{"foo":1}'));

// Act + assert
assertThrows(() => config.load(), config.ConfigError,
    'valid JSON with wrong shape must throw ConfigError');

// User-facing error messages must not leak the absolute path (and thus the
// username) — they end up in the panel and the journal.
try {
    config.load();
} catch (e) {
    if (e.message.includes(GLib.get_user_data_dir()))
        throw new Error('ConfigError message must not contain the absolute path');
}

// Re-save a valid config so subsequent assertions start from a clean state.
if (!config.save({ version: 1, accounts: [] }))
    throw new Error('save after shape-failure test should succeed');
