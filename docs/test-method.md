# Deploy, Test & Debug with Nested GNOME Shell

A nested GNOME Shell session runs inside a window on your existing desktop. You can restart it instantly without logging out, making it the fastest way to iterate on extension code during development.

## 1. Install dependencies

```bash
sudo apt install -y mutter-dev-bin
```

Verify:

```bash
gnome-shell --help 2>&1 | grep devkit
# Should show: --devkit    Run development kit
```

## 2. Quick test cycle

```bash
# 1. Install the extension
./install.sh

# 2. Launch nested shell in a terminal window
dbus-run-session gnome-shell --devkit --wayland

# 3. In another terminal, enable the extension inside the nested session
gnome-extensions enable ai-usage-monitor@m7medvision

# 4. Test — click the panel indicator, check menu, verify data

# 5. Make code changes to extension.js / providers/*.js

# 6. Re-install and restart nested shell
./install.sh
# Close nested shell window and relaunch dbus-run-session gnome-shell --devkit --wayland
gnome-extensions enable ai-usage-monitor@m7medvision

# 7. Repeat from step 4
```

## 3. Reload script

Use the repository's `dev-reload.sh`; its copy list is kept in sync with runtime modules.

Usage:

```bash
# Terminal 1: start nested shell
dbus-run-session gnome-shell --devkit --wayland

# Terminal 2: after each code change
./dev-reload.sh
# Close nested shell, relaunch, enable extension
```

## 4. Debugging techniques

### 4a. Read extension logs

```bash
# Watch logs from inside the nested shell session
journalctl --user -f | grep "\[ai-usage\]"
```

The extension logs provider fetch results with the `[ai-usage]` prefix.

### 4b. Add custom logging

In `extension.js` or provider files, use the global `log()` function:

```javascript
log(`[ai-usage] Debug: ${someVariable}`);
log(`[ai-usage] ${provider.id}: result=${JSON.stringify(result)}`);
```

`log()` output appears in the user journal. `logError()` is also available for error-level messages.

### 4c. Check extension state via DBus

```bash
UUID="ai-usage-monitor@m7medvision"

# Get full extension info (state, enabled, error)
busctl --user call org.gnome.Shell /org/gnome/Shell \
    org.gnome.Shell.Extensions GetExtensionInfo s "$UUID"

# Get only error field
busctl --user call org.gnome.Shell /org/gnome/Shell \
    org.gnome.Shell.Extensions GetExtensionInfo s "$UUID" \
    | grep -oP '"error" s "\K[^"]*'

# List all known extensions
gnome-extensions list

# Enable / disable
gnome-extensions enable "$UUID"
gnome-extensions disable "$UUID"

# List extension errors
busctl --user call org.gnome.Shell /org/gnome/Shell \
    org.gnome.Shell.Extensions GetExtensionErrors s "$UUID"
```

### 4d. Inspect account configuration

Provider credentials are stored in `~/.local/share/.ai-usage-ext/config.json`, not GSettings. Avoid printing or pasting this file into logs because it contains secrets.

### 4e. Check GSettings

```bash
SCHEMA="org.gnome.shell.extensions.ai-usage"

# List all keys and values
gsettings list-recursively "$SCHEMA"

# Set a key
gsettings set "$SCHEMA" refresh-interval 60
```

### 4f. Inspect raw DBus method calls

```bash
# Open preferences programmatically
gdbus call --session --dest org.gnome.Shell.Extensions \
    --object-path /org/gnome/Shell/Extensions \
    --method org.gnome.Shell.Extensions.OpenExtensionPrefs \
    "ai-usage-monitor@m7medvision" "" '{}'

# Force refresh (indirectly by triggering preferences)
# The extension has a "Refresh" button in the menu
```

### 4g. Check menu state

```bash
# List all menu items for the extension
busctl --user call org.gnome.Shell /org/gnome/Shell \
    org.gnome.Shell.Extensions ListExtensions \
    | grep -o '"ai-usage[^"]*"]*"[^}]*}' | python3 -c "
import sys, re
text = sys.stdin.read()
for key in ['name', 'state', 'enabled', 'error']:
    m = re.search(rf'\"{key}\" [a-z] \"([^\"]*)\"', text)
    if m: print(f'{key}: {m.group(1)}')"
```

## 5. Provider debugging

### Check if a provider has auth configured

Open Preferences and inspect the account's credential fields. Do not print credential values to the terminal or journal.

### Run isolated checks

```bash
gjs -m tests/core.test.js
XDG_DATA_HOME="$(mktemp -d)" gjs -m tests/config.test.js
```

## 6. Common issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Schema could not be found" | `glib-compile-schemas` not run | Run `glib-compile-schemas` on both extension `schemas/` dir and `~/.local/share/glib-2.0/schemas/` |
| Extension not in `gnome-extensions list` | Shell hasn't discovered it | Restart nested shell; on main session log out/in |
| `No property X on StWidget` | Using invalid St constructor options | Check GNOME Shell St API docs; avoid `style`, `spacing`, percentage widths |
| `Tried to construct object without a GType` | Subclassing GObject without registration | Don't subclass GObject classes; use composition instead |
| Provider returns `attempted: false` | Auth not configured | Verify the account credentials in Preferences |
| Extension loads but menu empty | `_rebuildMenu` logic bug or fetch silently failed | Add `log()` calls; check journal for `[ai-usage]` prefix |
| OpenCode Go returns 302/auth page | Cookie expired | Refresh cookie from browser DevTools → Cookies |
| Panel icon not visible | Widget sizing/visibility issue | Use simple `St.Label` instead of `St.Widget` bars |

## 7. File layout for debugging

```
~/.local/share/gnome-shell/extensions/ai-usage-monitor@m7medvision/
├── extension.js          ← Shell entry shim
├── prefs.js              ← Preferences entry shim
├── config.js             ← Account persistence (atomic 0600 write)
├── local-detect.js       ← Auto-detect CLI credentials (~/.claude, opencode)
├── domain/               ← Pure rules (no GNOME imports)
│   ├── usage.js          ← usageLevel, worstPercentUsed, pickPrimaryEntry
│   ├── peak.js           ← currentPeakStatus
│   ├── entry-kind.js     ← EntryKind discriminated union
│   ├── account.js        ← Account value object
│   ├── usage-entry.js    ← UsageEntry value object
│   └── usage-result.js   ← UsageResult value object
├── application/          ← Use-case orchestration
│   ├── refresh-service.js
│   ├── fetch-service.js
│   ├── single-flight.js
│   ├── scheduler.js
│   └── account-repository.js
├── ui/                   ← Presentation
│   ├── extension-entry.js, indicator.js
│   ├── tabs.js, overview.js, content.js, menu.js
│   ├── panel-icon.js, peak-ticker.js, config-monitor.js
│   ├── format.js         ← palette + formatters
│   ├── usage-color.js    ← severity → color
│   ├── prefs/            ← Adwaita pages, account CRUD, OAuth, credential Strategies
│   └── entry-view/       ← per-kind Strategy renderers
│       ├── index.js      ← dispatcher
│       ├── percent-view.js
│       ├── bar-chart-view.js
│       ├── stacked-bar-chart-view.js
│       ├── cost-distribution-view.js
│       ├── peak-status-view.js
│       └── value-box-view.js
├── providers/            ← Provider Strategy adapters
│   ├── index.js          ← Provider registry
│   ├── zai.js, opencode-go.js, openai.js, deepseek.js, claude-code.js
│   ├── colors.js, constants.js
├── stylesheet.css        ← Panel/menu styling
├── metadata.json         ← UUID, version, shell-version
└── schemas/
    ├── org.gnome.shell.extensions.ai-usage.gschema.xml
    └── gschemas.compiled
```
