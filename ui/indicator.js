/* AI Usage Monitor — GNOME Shell Extension
 *
 * Composition root for the shell-side indicator. Builds the panel button,
 * the popup menu (header + provider selector + content), and wires the application
 * services (RefreshService, AccountRepository) to GNOME actors. Entry
 * rendering lives in ui/entry-view/, lifecycle in application/, domain
 * rules in domain/. */

import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup?version=3.0';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

import * as config from '../config.js';
import { RefreshService } from '../application/refresh-service.js';
import { FetchService } from '../application/fetch-service.js';
import { AccountRepository } from '../application/account-repository.js';
import { UsageAlertService } from '../application/usage-alert-service.js';
import { createAlertStateStore } from '../infrastructure/alert-state-store.js';
import { worstPercentUsed } from '../domain/usage.js';
import { PROVIDERS } from '../providers/index.js';
import { colorForPercent } from './usage-color.js';
import { providerLogo } from './provider-logo.js';
import { createProviderSelector } from './provider-selector.js';
import { renderContent } from './content.js';
import { createPanelIcon, updatePanelIcon } from './panel-icon.js';
import { buildMenu } from './menu.js';
import { createPeakTicker } from './peak-ticker.js';
import { createConfigMonitor } from './config-monitor.js';
import { createShellNotifier } from './shell-notifier.js';

const MIN_REFRESH_DELAY_MS = 1000;

export const Indicator = GObject.registerClass(
    { GTypeName: 'AiUsageIndicator' },
    class Indicator extends PanelMenu.Button {
        _init(ext) {
            super._init(0.0, 'AI Usage');
            this._ext = ext;
            this._settings = ext.getSettings();
            this._destroyed = false;
            this._session = new Soup.Session();
            this._fetcher = new FetchService({ session: this._session });
            this._results = {};              // keyed by account id
            this._activeProviderId = null;
            this._accounts = new AccountRepository(PROVIDERS);
            this._alerts = new UsageAlertService({
                stateStore: createAlertStateStore({ logger: message => log(message) }),
                notify: createShellNotifier(),
                logger: message => log(message),
            });
            this._refresh = new RefreshService({
                fetch: async () => this._applyResults(
                    await this._fetcher.fetchAll(this._getAccounts())),
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
            this._contentBox = menu.contentBox;
            this._providerSelector = createProviderSelector({
                button: menu.providerSelectorButton,
                label: menu.providerSelectorLabel,
                onSelect: id => {
                    this._activeProviderId = id;
                    this._renderContent();
                },
            });
            this._peakWidgets = null;     // populated by renderers via ctx.onPeakTick
            this._renderProviderSelector();
            this._renderContent();

            this._settingsId = this._settings.connect('changed', () => {
                this._scheduleRefresh();
            });
            this._configMonitor = createConfigMonitor(
                config.configPath(), () => this._scheduleRefresh());
            this._scheduleRefresh();

            /* Peak-status ticker: ticks every 1s while the menu is open so
             * the traffic-light countdown stays live. Started on open, stopped
             * on close — never runs with the menu hidden. */
            this._peakTicker = createPeakTicker(() => this._peakWidgets);
            this.menu.connect('open-state-changed', (menu, open) => {
                if (open) this._peakTicker.start();
                else {
                    this._peakTicker.stop();
                    this._providerSelector.close();
                }
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

        /* ── Provider selector ── */

        _renderProviderSelector() {
            this._activeProviderId = this._providerSelector.render({
                accounts: this._getAccounts(),
                selectedId: this._activeProviderId,
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
                activeProviderId: this._activeProviderId,
                configError: this._accounts.lastError,
                ctx: this._entryContext(),
                onSelectProvider: id => {
                    this._activeProviderId = id;
                    this._renderProviderSelector();
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

        _applyResults(results) {
            if (this._destroyed)
                return;
            for (const [accountId, result] of results.entries())
                this._results[accountId] = result;
            this._sendUsageAlerts(results);
            this._updatePanel();
            this._renderProviderSelector();
            this._renderContent();
        }

        _sendUsageAlerts(results) {
            try {
                this._alerts.process({
                    accounts: this._getAccounts().map(({ account }) => account),
                    results,
                    enabled: this._settings.get_boolean('usage-alerts-enabled'),
                    threshold: this._settings.get_int('usage-alert-threshold'),
                });
            } catch (error) {
                // Notifications are non-critical: rendering must continue even
                // if a local cache or Shell integration unexpectedly fails.
                logError(error, 'AI Usage alert processing failed');
            }
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
            this._providerSelector.destroy();
            if (this._settingsId) { this._settings.disconnect(this._settingsId); this._settingsId = 0; }
            this._configMonitor.dispose();
            super.destroy();
        }
    }
);
