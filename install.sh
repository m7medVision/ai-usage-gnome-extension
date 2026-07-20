#!/bin/bash
# Install AI Usage Monitor GNOME Shell Extension
set -euo pipefail

UUID="ai-usage-monitor@m7medvision"
EXT_DIR="${HOME}/.local/share/gnome-shell/extensions/${UUID}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

echo "Installing AI Usage Monitor extension..."
echo "Target: ${EXT_DIR}"

# Remove stale modules from prior layouts, then create a clean destination.
rm -rf "${EXT_DIR}"
mkdir -p "${EXT_DIR}/schemas"

# Copy files
cp "${SCRIPT_DIR}/extension.js" "${SCRIPT_DIR}/prefs.js" \
    "${SCRIPT_DIR}/config.js" "${SCRIPT_DIR}/local-detect.js" \
    "${SCRIPT_DIR}/stylesheet.css" "${SCRIPT_DIR}/metadata.json" "${EXT_DIR}/"
cp -r "${SCRIPT_DIR}/domain" "${SCRIPT_DIR}/application" \
    "${SCRIPT_DIR}/infrastructure" "${SCRIPT_DIR}/ui" "${SCRIPT_DIR}/providers" \
    "${SCRIPT_DIR}/media" "${EXT_DIR}/"
cp "${SCRIPT_DIR}/schemas/org.gnome.shell.extensions.ai-usage.gschema.xml" \
    "${EXT_DIR}/schemas/"

# Compile GSettings schema
glib-compile-schemas "${EXT_DIR}/schemas/"

echo ""
echo "Installation complete!"
echo ""
echo "Next steps:"
echo "  1. Restart GNOME Shell:"
echo "     - X11: Alt+F2, type 'r', press Enter"
echo "     - Wayland: Log out and back in"
echo "  2. Enable the extension:"
echo "     gnome-extensions enable ${UUID}"
echo "  3. Open AI Usage Monitor preferences to configure accounts"
