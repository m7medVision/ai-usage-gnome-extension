import Gio from 'gi://Gio';

export function createConfigMonitor(path, onChange) {
    const file = Gio.File.new_for_path(path);
    let monitor = null;
    let signalId = 0;

    try {
        monitor = file.monitor_file(Gio.FileMonitorFlags.NONE, null);
        signalId = monitor.connect('changed', onChange);
    } catch (e) {
        log(`[ai-usage] could not monitor config: ${e}`);
    }

    return {
        dispose() {
            if (signalId && monitor)
                monitor.disconnect(signalId);
            signalId = 0;
            if (monitor)
                monitor.cancel();
            monitor = null;
        },
    };
}
