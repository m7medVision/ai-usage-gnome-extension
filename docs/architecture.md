# Architecture

The extension uses layered modules with dependencies pointing inward:

```text
GNOME entry shims
  -> UI mediators and views
      -> application services
          -> domain rules

UI and application
  -> provider adapters
  -> config/local-detection infrastructure
  -> alert-state infrastructure
```

`domain/` imports no GNOME APIs. `application/` contains orchestration without
widgets. `ui/` owns Shell, St, GTK, and Adwaita actors. `providers/` adapts
remote provider APIs to the shared `UsageResult` contract.

## Entry Points

- `extension.js` re-exports `ui/extension-entry.js` for GNOME Shell.
- `prefs.js` re-exports `ui/prefs/extension-prefs-entry.js` for Preferences.
- `ui/indicator.js` mediates shell lifecycle, application services, and views.
- `ui/prefs/extension-prefs-entry.js` mediates preference pages and OAuth.

## Layers

### Domain

- `usage.js`: percentage rules and primary-entry selection.
- `usage-alert-policy.js`: pure threshold-crossing, rearm, and alert de-duplication rules.
- `peak.js`: peak-window state calculations.
- `entry-kind.js`: discriminated entry-kind contract.
- `account.js`, `usage-entry.js`, `usage-result.js`: boundary value shapes.

### Application

- `fetch-service.js`: fetches all accounts and isolates provider failures.
- `refresh-service.js`: composes scheduling and single-flight refreshes.
- `scheduler.js`: timer lifecycle and stale-callback invalidation.
- `single-flight.js`: coalesces concurrent requests.
- `account-repository.js`: shell-side account loading and error state.
- `usage-alert-service.js`: evaluates alert policy, persists its ledger, and emits notification events through injected ports.

### Providers

`providers/index.js` is the Strategy registry. Each adapter owns its display
metadata, default credential shape, authentication, transport, and response
normalization.

### Infrastructure

- `alert-state-store.js`: cache-backed, non-secret persistence for alert de-duplication across Shell restarts.

### Shell UI

- `indicator.js`: lifecycle Mediator; contains no chart implementation.
- `shell-notifier.js`: GNOME Shell adapter that presents application alert events.
- `provider-selector.js`, `overview.js`, `content.js`: popup-region views.
- `entry-view/`: renderer Strategy per `EntryKind`.
- `menu.js`, `panel-icon.js`: widget builders.
- `peak-ticker.js`, `config-monitor.js`: resource owners with symmetric cleanup.

### Preferences UI

- `general-page.js`, `refresh-page.js`, `accounts-page.js`: page builders.
- `account-row.js`: provider-independent account row.
- `credentials-fields/`: Strategy per provider's credential fields.
- `account-repository-gtk.js`: GTK-side config CRUD and dialog error boundary.
- `account-detection.js`: pure import/deduplication policy.
- `providers/zai-oauth.js`: cancellable OAuth transport/state machine; Preferences injects browser/UI callbacks.

## Patterns

| Pattern | Location | Reason |
|---|---|---|
| Strategy | `providers/`, `ui/entry-view/`, `ui/prefs/credentials-fields/` | Multiple real implementations vary behind one contract. |
| Registry | `providers/index.js` | Shell and Preferences share one provider source of truth. |
| Mediator | `ui/indicator.js`, `ui/prefs/extension-prefs-entry.js` | Entry classes coordinate collaborators without owning their details. |
| Repository | `application/account-repository.js`, `ui/prefs/account-repository-gtk.js` | Shell and GTK expose config errors through different UI boundaries. |
| SingleFlight | `application/single-flight.js` | Concurrent refresh requests share one network pass. |
| Scheduler | `application/scheduler.js` | Timer lifecycle is testable and stale callbacks cannot re-arm. |
| Dispatcher | `ui/entry-view/index.js`, `ui/prefs/credentials-fields/index.js` | Adding a kind/provider adds one strategy and one registration line. |
| Resource owner | `ui/peak-ticker.js`, `ui/config-monitor.js` | Native timers and monitors have explicit, symmetric cleanup. |

## Extension Rules

1. New provider: add one adapter and register it in `providers/index.js`.
2. New usage entry kind: add its domain kind and one entry-view strategy.
3. New provider credential UI: add one credential-fields strategy.
4. Domain modules must not import `gi://`, St, GTK, Adwaita, or Shell resources.
5. Provider failures return `UsageResult.errors`; one provider cannot reject the batch.
6. Native resources must expose and invoke cleanup during disable/window close.
7. Alert policy is domain-only; cache persistence and GNOME notifications are injected application dependencies.

## Verification

```bash
./tests/run.sh
bash -n install.sh dev-reload.sh tests/run.sh
```

Runtime behavior is verified with the nested GNOME Shell procedure in
[`test-method.md`](test-method.md).
