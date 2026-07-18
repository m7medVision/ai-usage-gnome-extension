/* AI Usage Monitor — GNOME Shell Extension
 *
 * Composition root for the shell-side indicator. Builds the panel button,
 * the popup menu (header + tabs + content), and wires the application
 * services (RefreshService, AccountRepository) to GNOME actors. Entry
 * rendering lives in ui/entry-view/, lifecycle in application/, domain
 * rules in domain/. */

import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup?version=3.0';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

import * as config from './config.js';
import { RefreshService } from './application/refresh-service.js';
import { AccountRepository } from './application/account-repository.js';
import { worstPercentUsed } from './domain/usage.js';
import { PROVIDERS } from './providers/index.js';
import { colorForPercent } from './ui/usage-color.js';
import { renderTabs, providerLogo } from './ui/tabs.js';
import { renderContent } from './ui/content.js';
import { createPanelIcon, updatePanelIcon } from './ui/panel-icon.js';
import { buildMenu } from './ui/menu.js';
import { createPeakTicker } from './ui/peak-ticker.js';
import { createConfigMonitor } from './ui/config-monitor.js';

const MIN_REFRESH_DELAY_MS = 1000;

const Indicator = GObject.registerClass(
    { GTypeName: 'AiUsageIndicator' },
    class Indicator extends PanelMenu.Button {
        _init(ext) {
            super._init(0.0, 'AI Usage');
            this._ext = ext;
            this._settings = ext.getSettings();
            this._destroyed = false;
            this._session = new Soup.Session();
            this._results = {};              // keyed by account id
            this._activeAccountId = null;
            this._accounts = new AccountRepository(PROVIDERS);
            this._refresh = new RefreshService({
                fetch: () => this._fetchAll(),
                schedule: (delayMs, callback) => GLib.timeout_add(
                    GLib.PRIORITY_DEFAULT,
                    Math.min(Math.max(MIN_REFRESH_DELAY_MS, delayMs), 2147483647),
                    () => {
                        callback().catch(e => logError(e));
                        return GLib.SOURCE_REMOVE;
                    }),
                cancel: sourceId => GLib.source_remove(sourceId),
            });

            this._panelIcon = createPanelIcon();
            this.add_child(this._panelIcon);

            const menu = buildMenu({
                menuBox: this.menu.box,
                onRefresh: () => this._refreshNow(),
                onOpenPreferences: () => {
                    this._ext.openPreferences();
                    this.menu.close();
                },
            });
            this._headerTitle = menu.headerTitle;
            this._refreshBtn = menu.refreshBtn;
            this._tabsContainer = menu.tabsContainer;
            this._contentBox = menu.contentBox;

            this._settingsId = this._settings.connect('changed', () => {
                this._scheduleRefresh();
            });
            this._configMonitor = createConfigMonitor(
                config.configPath(), () => this._scheduleRefresh());
            this._scheduleRefresh();

            /* Peak-status ticker: ticks every 1s while the menu is open so
             * the traffic-light countdown stays live. Started on open, stopped
             * on close — never runs with the menu hidden. */
            this._peakWidgets = null;     // populated by renderers via ctx.onPeakTick
            this._peakTicker = createPeakTicker(() => this._peakWidgets);
            this.menu.connect('open-state-changed', (menu, open) => {
                if (open) this._peakTicker.start();
                else this._peakTicker.stop();
            });
        }

        /* Build [{account, provider}] for enabled, authenticated accounts. */
        _getAccounts() {
            return this._accounts.loadEnabled();
        }

        /* Presentation context handed to every entry renderer. Keeps the
         * views free of GSettings + lifecycle imports. */
        _entryContext() {
            return {
                displayMode: this._settings.get_string('display-mode'),
                colorForPercent: pct => colorForPercent(pct, this._settings),
                onPeakTick: fn => { this._peakWidgets.push(fn); },
                showLogos: this._settings.get_boolean('show-logos'),
                logoProvider: p => providerLogo(p, this._ext.path),
            };
        }

        /* ── Tabs ── */

        _renderTabs() {
            this._activeAccountId = renderTabs({
                container: this._tabsContainer,
                accounts: this._getAccounts(),
                activeAccountId: this._activeAccountId,
                showLogos: this._settings.get_boolean('show-logos'),
                logoProvider: p => providerLogo(p, this._ext.path),
                onSelect: id => {
                    this._activeAccountId = id;
                    this._renderTabs();
                    this._renderContent();
                },
            });
        }

        /* ── Content ── */

        _renderContent() {
            this._contentBox.destroy_all_children();
            // Reset the peak-widget list so stale update closures (pointing at
            // destroyed labels) don't fire from the ticker.
            this._peakWidgets = [];

            renderContent({
                parent: this._contentBox,
                accounts: this._getAccounts(),
                results: this._results,
                activeAccountId: this._activeAccountId,
                configError: this._accounts.lastError,
                ctx: this._entryContext(),
                onSelectAccount: id => {
                    this._activeAccountId = id;
                    this._renderTabs();
                    this._renderContent();
                },
            });
        }
        /* ── Panel update ── */

        _updatePanel() {
            const accounts = this._getAccounts().map(({ account }) => account);
            const percentUsed = worstPercentUsed(accounts, this._results);
            updatePanelIcon(this._panelIcon, percentUsed, this._settings);
        }

        /* ── Fetching ── */

        async _fetchAll() {
            const accounts = this._getAccounts();
            log(`[ai-usage] Fetching ${accounts.length} account(s)`);
            const results = await Promise.all(accounts.map(async ({ account, provider }) => {
                try {
                    const result = await provider.fetch(this._session, account.credentials);
                    log(`[ai-usage] ${account.label}: attempted=${result.attempted} entries=${result.entries?.length || 0} errors=${result.errors?.length || 0}`);
                    return [account.id, result];
                } catch (e) {
                    return [account.id, {
                        attempted: true, entries: [],
                        errors: [`${account.label}: ${e.message || e}`],
                    }];
                }
            }));
            if (this._destroyed)
                return;
            for (const [accountId, result] of results)
                this._results[accountId] = result;
            this._updatePanel();
            this._renderTabs();
            this._renderContent();
        }

        async _refreshNow() {
            this._refreshBtn.reactive = false;
            this._headerTitle.set_text('AI Usage (Refreshing…)');
            try {
                await this._refresh.refresh();
            } finally {
                if (!this._destroyed) {
                    this._headerTitle.set_text('AI Usage');
                    this._refreshBtn.reactive = true;
                }
            }
        }

        _scheduleRefresh() {
            const interval = this._settings.get_int('refresh-interval') * 1000;
            this._refresh.start(interval).catch(e => logError(e));
        }

        destroy() {
            this._destroyed = true;
            this._refresh.stop();
            this._session.abort();
            this._peakTicker.stop();
            this._peakWidgets = null;
            if (this._settingsId) { this._settings.disconnect(this._settingsId); this._settingsId = 0; }
            this._configMonitor.dispose();
            super.destroy();
        }
    }
);

export default class AiUsageExtension extends Extension {
    enable() {
        this._indicator = new Indicator(this);
        Main.panel.addToStatusArea(this.uuid, this._indicator, 1, 'right');
    }
    disable() {
        if (this._indicator) { this._indicator.destroy(); this._indicator = null; }
        // Module-level provider caches survive enable/disable; reset on every
        // disable so a fresh enable starts from a clean cache. The GJS module
        // evaluator only runs once per process, so this is the only path.
        PROVIDERS['opencode-go']?.resetCache?.();
    }
}
