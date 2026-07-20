import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';

/* Build a provider logo icon when its optional local asset is available. */
export function providerLogo(provider, extPath) {
    if (!provider.logoFile) return null;
    const path = GLib.build_filenamev([extPath, 'media', 'logos', provider.logoFile]);
    if (!GLib.file_test(path, GLib.FileTest.EXISTS)) return null;
    try {
        const styleClass = provider.fullColorLogo
            ? 'ai-usage-provider-logo-color'
            : 'ai-usage-provider-logo';
        return new St.Icon({
            gicon: Gio.Icon.new_for_string(path),
            style_class: styleClass,
        });
    } catch (_) {
        return null;
    }
}
