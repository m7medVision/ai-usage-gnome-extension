#!/bin/bash
# Quick reload script for extension development with nested GNOME Shell.
# Usage: ./dev-reload.sh
set -euo pipefail

UUID="ai-usage-monitor@ahati"
EXT_DIR="${HOME}/.local/share/gnome-shell/extensions/${UUID}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

rm -rf "${EXT_DIR}"
mkdir -p "${EXT_DIR}/schemas"
cp "${SCRIPT_DIR}/extension.js" "${SCRIPT_DIR}/prefs.js" \
    "${SCRIPT_DIR}/config.js" "${SCRIPT_DIR}/local-detect.js" \
    "${SCRIPT_DIR}/stylesheet.css" "${SCRIPT_DIR}/metadata.json" "${EXT_DIR}/"
cp -r "${SCRIPT_DIR}/providers" "${SCRIPT_DIR}/domain" \
    "${SCRIPT_DIR}/application" "${SCRIPT_DIR}/ui" "${SCRIPT_DIR}/media" "${EXT_DIR}/"
cp "${SCRIPT_DIR}"/schemas/*.xml "${EXT_DIR}/schemas/"
glib-compile-schemas "${EXT_DIR}/schemas/"
chmod 664 "${EXT_DIR}/"*.{js,css,json} "${EXT_DIR}/schemas/"*

echo "Installed. Now restart nested shell and enable:"
echo "  gnome-extensions enable ${UUID}"
