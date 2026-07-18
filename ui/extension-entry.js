import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

import { PROVIDERS } from '../providers/index.js';
import { Indicator } from './indicator.js';

export default class AiUsageExtension extends Extension {
    enable() {
        this._indicator = new Indicator(this);
        Main.panel.addToStatusArea(this.uuid, this._indicator, 1, 'right');
    }

    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }

        // GJS evaluates provider modules once per process, so mutable adapter
        // caches must be reset explicitly on every disable/re-enable cycle.
        PROVIDERS['opencode-go']?.resetCache?.();
    }
}
