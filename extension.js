/* AI Usage Monitor — GNOME Shell Extension
 *
 * Composition root for the shell-side indicator. Builds the panel button,
 * the popup menu (header + tabs + content), and wires the application
 * services (RefreshService, AccountRepository) to GNOME actors. Entry
 * rendering lives in ui/entry-view/, lifecycle in application/, domain
 * rules in domain/. */

import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Soup from 'gi://Soup?version=3.0';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

import * as config from './config.js';
import { RefreshService } from './application/refresh-service.js';
import { AccountRepository } from './application/account-repository.js';
import { clampPercent as clamp, pickPrimaryEntry, worstPercentUsed } from './domain/usage.js';
import { PROVIDERS } from './providers/index.js';
import { COLOR_MUTED } from './ui/format.js';
import { colorForPercent } from './ui/usage-color.js';
import { addEntry } from './ui/entry-view/index.js';
import { addProgressBar } from './ui/entry-view/shared.js';

const OVERVIEW_ID = '__overview__';
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

            /* ── Panel: gauge icon, colored by usage severity ── */
            this._panelIcon = new St.Icon({
                icon_name: 'stopwatch-symbolic',
                style_class: 'ai-usage-panel-icon',
            });
            this.add_child(this._panelIcon);

            this._buildMenu();
            this._settingsId = this._settings.connect('changed', () => {
                this._scheduleRefresh();
            });
            this._setupConfigMonitor();
            this._scheduleRefresh();

            /* Peak-status ticker: ticks every 1s while the menu is open so
             * the traffic-light countdown stays live. Started on open, stopped
             * on close — never runs with the menu hidden. */
            this._peakWidgets = null;     // populated by renderers via ctx.onPeakTick
            this._peakTickerId = 0;
            this.menu.connect('open-state-changed', (menu, open) => {
                if (open) this._startPeakTicker();
                else this._stopPeakTicker();
            });
        }

        _startPeakTicker() {
            if (this._peakTickerId) return;
            this._peakTickerId = GLib.timeout_add_seconds(
                GLib.PRIORITY_DEFAULT, 1, () => {
                    if (this._peakWidgets) {
                        for (const u of this._peakWidgets) {
                            try { u(); } catch (e) { log(`[ai-usage] peak tick: ${e}`); }
                        }
                    }
                    return GLib.SOURCE_CONTINUE;
                });
        }

        _stopPeakTicker() {
            if (this._peakTickerId) {
                GLib.source_remove(this._peakTickerId);
                this._peakTickerId = 0;
            }
        }

        _buildMenu() {
            this.menu.box.add_style_class_name('ai-usage-popup');

            // Header row
            this._headerBox = new St.BoxLayout({
                style_class: 'ai-usage-header',
                x_expand: true,
            });
            this._headerTitle = new St.Label({
                text: 'AI Usage',
                style_class: 'ai-usage-header-title',
                x_expand: true,
                y_align: Clutter.ActorAlign.CENTER,
            });
            this._headerBox.add_child(this._headerTitle);

            this._refreshBtn = this._iconButton('view-refresh-symbolic');
            this._refreshBtn.connect('clicked', () => {
                this._refreshNow();
                return Clutter.EVENT_PROPAGATE;
            });
            this._headerBox.add_child(this._refreshBtn);

            this._settingsBtn = this._iconButton('preferences-system-symbolic');
            this._settingsBtn.connect('clicked', () => {
                this._ext.openPreferences();
                this.menu.close();
                return Clutter.EVENT_PROPAGATE;
            });
            this._headerBox.add_child(this._settingsBtn);
            this.menu.box.add_child(this._headerBox);

            // Provider tabs row
            this._tabsContainer = new St.BoxLayout({
                style_class: 'ai-usage-tabs-container',
            });
            this.menu.box.add_child(this._tabsContainer);

            // Content area
            this._contentBox = new St.BoxLayout({
                style_class: 'ai-usage-usage-section',
                vertical: true,
            });
            this.menu.box.add_child(this._contentBox);
        }

        _iconButton(iconName) {
            const btn = new St.Button({
                style_class: 'ai-usage-header-button',
                can_focus: true,
            });
            btn.set_child(new St.Icon({
                icon_name: iconName,
                style_class: 'ai-usage-header-button-icon',
            }));
            return btn;
        }

        /* Watch config.json for external changes (e.g. prefs edits). */
        _setupConfigMonitor() {
            const file = Gio.File.new_for_path(config.configPath());
            try {
                this._configMonitor = file.monitor_file(Gio.FileMonitorFlags.NONE, null);
                this._configMonitorId = this._configMonitor.connect('changed', () => {
                    this._scheduleRefresh();
                });
            } catch (e) {
                log(`[ai-usage] could not monitor config: ${e}`);
            }
        }

        /* Build [{account, provider}] for enabled, authenticated accounts. */
        _getAccounts() {
            const out = this._accounts.loadEnabled();
            this._configError = this._accounts.lastError;
            return out;
        }

        /* Presentation context handed to every entry renderer. Keeps the
         * views free of GSettings + lifecycle imports. */
        _entryContext() {
            return {
                displayMode: this._settings.get_string('display-mode'),
                colorForPercent: pct => colorForPercent(pct, this._settings),
                onPeakTick: fn => { this._peakWidgets.push(fn); },
            };
        }

        /* ── Tabs ── */

        _renderTabs() {
            this._tabsContainer.destroy_all_children();
            const accounts = this._getAccounts();
            const showLogos = this._settings.get_boolean('show-logos');
            const showOverview = accounts.length > 1;

            const validIds = new Set(accounts.map(a => a.account.id));
            if (showOverview) validIds.add(OVERVIEW_ID);
            if (!validIds.has(this._activeAccountId))
                this._activeAccountId = showOverview ? OVERVIEW_ID : (accounts[0]?.account.id ?? null);

            if (showOverview) {
                const btn = new St.Button({
                    style_class: 'ai-usage-tab',
                    can_focus: true,
                });
                btn.set_child(new St.Label({
                    text: 'Overview',
                    y_align: Clutter.ActorAlign.CENTER,
                }));
                if (this._activeAccountId === OVERVIEW_ID)
                    btn.add_style_class_name('ai-usage-tab-active');
                btn.connect('clicked', () => {
                    this._activeAccountId = OVERVIEW_ID;
                    this._renderTabs();
                    this._renderContent();
                    return Clutter.EVENT_PROPAGATE;
                });
                this._tabsContainer.add_child(btn);
            }

            for (const { account, provider } of accounts) {
                const btn = new St.Button({
                    style_class: 'ai-usage-tab',
                    can_focus: true,
                });
                const inner = new St.BoxLayout({ y_align: Clutter.ActorAlign.CENTER });
                if (showLogos) {
                    const logo = this._providerLogo(provider);
                    if (logo) inner.add_child(logo);
                }
                inner.add_child(new St.Label({
                    text: account.label || provider.name,
                    y_align: Clutter.ActorAlign.CENTER,
                }));
                btn.set_child(inner);
                if (account.id === this._activeAccountId)
                    btn.add_style_class_name('ai-usage-tab-active');
                btn.connect('clicked', () => {
                    this._activeAccountId = account.id;
                    this._renderTabs();
                    this._renderContent();
                    return Clutter.EVENT_PROPAGATE;
                });
                this._tabsContainer.add_child(btn);
            }
        }

        _providerLogo(provider) {
            if (!provider.logoFile) return null;
            const path = GLib.build_filenamev([
                this._ext.path, 'media', 'logos', provider.logoFile,
            ]);
            if (!GLib.file_test(path, GLib.FileTest.EXISTS)) return null;
            try {
                const cls = provider.fullColorLogo
                    ? 'ai-usage-tab-icon-color'
                    : 'ai-usage-tab-icon';
                return new St.Icon({
                    gicon: Gio.Icon.new_for_string(path),
                    style_class: cls,
                });
            } catch (e) {
                return null;
            }
        }

        /* ── Content ── */

        _renderContent() {
            this._contentBox.destroy_all_children();
            // Reset the peak-widget list so stale update closures (pointing at
            // destroyed labels) don't fire from the ticker.
            this._peakWidgets = [];

            const accounts = this._getAccounts();
            const ctx = this._entryContext();

            if (this._configError) {
                this._addError(this._contentBox, this._configError);
                return;
            }

            if (this._activeAccountId === OVERVIEW_ID) {
                this._renderOverview(accounts, ctx);
                return;
            }

            const active = accounts.find(a => a.account.id === this._activeAccountId);
            if (!active) {
                this._addHint(this._contentBox, 'Configure accounts in Preferences…');
                return;
            }

            const { account } = active;
            const res = this._results[account.id];
            if (!res || !res.attempted) {
                this._addHint(this._contentBox, 'No data yet — refresh to fetch.');
                return;
            }

            if (!res.entries || res.entries.length === 0) {
                if (res.errors && res.errors.length) {
                    for (const err of res.errors)
                        this._addError(this._contentBox, err);
                } else {
                    this._addHint(this._contentBox,
                        'No usage data. Configure this account in Preferences…');
                }
                return;
            }

            let first = true;
            for (const e of res.entries) {
                if (!first) this._addSeparator(this._contentBox);
                first = false;
                addEntry(this._contentBox, e, ctx);
            }

            if (res.errors && res.errors.length) {
                this._addSeparator(this._contentBox);
                for (const err of res.errors)
                    this._addError(this._contentBox, err);
            }
        }

        /* One compact row per account, showing its primary limit (the "5h"
         * window when present, else the first percent entry, else the first
         * entry of any kind) — so every provider's headline number is
         * visible without switching tabs. Clicking a row jumps to that
         * account's own tab for full detail. */
        _renderOverview(accounts, ctx) {
            let first = true;
            for (const { account, provider } of accounts) {
                if (!first) this._addSeparator(this._contentBox);
                first = false;
                this._addOverviewRow(account, provider, ctx);
            }
        }

        _addOverviewRow(account, provider, ctx) {
            const res = this._results[account.id];
            const picked = pickPrimaryEntry(res);

            const btn = new St.Button({
                style_class: 'ai-usage-overview-row',
                can_focus: true,
                x_expand: true,
            });
            const box = new St.BoxLayout({ vertical: true, x_expand: true });

            const top = new St.BoxLayout({ x_expand: true });
            const labelBox = new St.BoxLayout({ x_expand: true, y_align: Clutter.ActorAlign.CENTER });
            if (this._settings.get_boolean('show-logos')) {
                const logo = this._providerLogo(provider);
                if (logo) labelBox.add_child(logo);
            }
            labelBox.add_child(new St.Label({
                text: account.label || provider.name,
                style_class: 'ai-usage-overview-label',
                y_align: Clutter.ActorAlign.CENTER,
            }));
            top.add_child(labelBox);

            const rightText = this._overviewRightText(picked);
            top.add_child(new St.Label({
                text: rightText,
                style_class: 'ai-usage-usage-subtitle ai-usage-usage-subtitle-right',
                y_align: Clutter.ActorAlign.CENTER,
            }));
            box.add_child(top);

            if (picked.state === 'percent') {
                const pctUsed = clamp(picked.entry.percentUsed ?? (picked.entry.percentRemaining != null
                    ? 100 - picked.entry.percentRemaining : 0));
                addProgressBar(box, pctUsed, ctx.colorForPercent(pctUsed));
            } else if (picked.state === 'error') {
                box.add_child(new St.Label({
                    text: `Error: ${picked.message}`,
                    style: 'color: #ff7800; font-size: 0.8em; margin-top: 2px;',
                }));
            }

            btn.set_child(box);
            btn.connect('clicked', () => {
                this._activeAccountId = account.id;
                this._renderTabs();
                this._renderContent();
                return Clutter.EVENT_PROPAGATE;
            });
            this._contentBox.add_child(btn);
        }

        _overviewRightText(picked) {
            if (picked.state === 'percent') {
                const e = picked.entry;
                const pctUsed = clamp(e.percentUsed ?? (e.percentRemaining != null ? 100 - e.percentRemaining : 0));
                const pctRemaining = clamp(100 - pctUsed);
                const label = (e.label || '').replace(/:$/, '');
                const pctText = this._settings.get_string('display-mode') === 'remaining'
                    ? `${Math.round(pctRemaining)}% left`
                    : `${Math.round(pctUsed)}% used`;
                return label ? `${label} · ${pctText}` : pctText;
            }
            if (picked.state === 'other') {
                const e = picked.entry;
                return e.value != null ? String(e.value) : (e.label || '—');
            }
            if (picked.state === 'not-configured') return 'Not configured';
            if (picked.state === 'no-data') return 'No data yet';
            if (picked.state === 'empty') return 'No usage data';
            if (picked.state === 'error') return 'Error';
            return '—';
        }

        _addHint(parent, text) {
            parent.add_child(new St.Label({
                text,
                style_class: 'ai-usage-usage-subtitle ai-usage-hint',
            }));
        }

        _addError(parent, text) {
            parent.add_child(new St.Label({
                text: `Error: ${text}`,
                style: 'color: #ff7800; font-weight: bold; margin-top: 4px;',
            }));
        }

        _addSeparator(parent) {
            parent.add_child(new St.Widget({
                style: 'height: 1px; background-color: rgba(255,255,255,0.05); margin: 8px 0;',
            }));
        }

        /* ── Panel update ── */

        _updatePanel() {
            const accounts = this._getAccounts().map(({ account }) => account);
            const percentUsed = worstPercentUsed(accounts, this._results);
            this._panelIcon.set_style(`color: ${
                percentUsed === null ? COLOR_MUTED : colorForPercent(percentUsed, this._settings)
            };`);
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
            this._stopPeakTicker();
            this._peakWidgets = null;
            if (this._settingsId) { this._settings.disconnect(this._settingsId); this._settingsId = 0; }
            if (this._configMonitorId && this._configMonitor) {
                this._configMonitor.disconnect(this._configMonitorId);
                this._configMonitorId = 0;
            }
            if (this._configMonitor) {
                this._configMonitor.cancel();
                this._configMonitor = null;
            }
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
    }
}
