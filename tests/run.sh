#!/bin/bash
# Run all extension tests under GJS. The config test writes a real config
# file, so it runs under an isolated XDG_DATA_HOME to avoid touching the
# caller's ~/.local/share.
set -e

cd "$(dirname "$0")/.."

failures=0

run() {
    local label="$1"
    shift
    if "$@"; then
        echo "OK   $label"
    else
        echo "FAIL $label"
        failures=1
    fi
}

run "tests/core.test.js"            gjs -m tests/core.test.js
run "tests/config.test.js"          env XDG_DATA_HOME="$(mktemp -d)" gjs -m tests/config.test.js
run "tests/domain/usage-alert-policy.test.js" gjs -m tests/domain/usage-alert-policy.test.js
run "tests/application/fetch-service.test.js" gjs -m tests/application/fetch-service.test.js
run "tests/application/usage-alert-service.test.js" gjs -m tests/application/usage-alert-service.test.js
run "tests/ui/prefs/account-detection.test.js" gjs -m tests/ui/prefs/account-detection.test.js
run "tests/ui/prefs/zai-oauth-flow.test.js" gjs -m tests/ui/prefs/zai-oauth-flow.test.js

exit $failures
