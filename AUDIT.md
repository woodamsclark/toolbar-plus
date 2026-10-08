# toolbar+ 0.1.18 release audit

Audit date: 2026-10-08

## Result

Local release preparation includes the current source, runtime assets, and final-settings-save fix. The user reports that the current build looks fine on their iPhone. Android remains untested because no device is available; the user accepts that limitation. The existing GitHub repository is `woodamsclark/toolbar-plus` on branch `main`; no GitHub releases were listed when checked on 2026-10-08.

## Automated validation

- TypeScript passes and all 47 behavior, lifecycle, settings, and persistence tests pass.
- Installed `main.js` exactly matches the source build.
- Manifest, package lock, package metadata, and `versions.json` agree on version 0.1.18 and minimum Obsidian 1.13.7.
- The runtime bundle imports only `obsidian`, with no Node.js, Electron, or development-package imports.
- Release packaging verifies each runtime file and ZIP entry against the current build. The ZIP contains exactly `main.js`, `manifest.json`, and `styles.css` inside the `toolbar-plus` folder.
- Settings writes are serialized and coalesced. Unload rejects new edits while allowing the latest queued snapshot to drain, including after a failed earlier write. Regression coverage exercises both the writer and plugin unload.
- An abrupt app/process termination can still interrupt asynchronous persistence; synchronous plugin unload cannot guarantee completion before process exit.
- A fresh dependency audit reports three development-dependency warnings: moderate findings for `moment` / the Obsidian SDK and a high finding for `source-map-js`. These packages are not bundled into the plugin; the runtime imports only the host-provided `obsidian` API. Development dependency updates remain separate maintenance work.

## Compatibility boundaries

The native `.mobile-toolbar` / `.mobile-toolbar-spacer` selectors, keyboard body class, and runtime command registry are internal Obsidian integration points. Host ownership is isolated in `MobileToolbarHost`; DOM/lifecycle tests cover host transitions, cleanup, command availability, keyboard events, and viewport geometry.

Floating mode detaches native toolbar and spacer elements and applies a scoped app-container height adjustment. These operations require real-device validation with the final build.

The browser preview loads production styles and displays layout measurements against a simulated keyboard. It does not provide automated rectangle assertions or establish real iOS/Android keyboard behavior.

## Device acceptance status

- iPhone: user-reported visual smoke check passed on 2026-10-08. This report does not establish that every scenario below was tested individually.
- Android: untested; user accepts release without an Android check.

## Additional device checks

After the 0.1.18 runtime files finish syncing and the plugin is reloaded:

- iPhone: dock, hide/reopen the keyboard, detach, type to the keyboard boundary, reveal/cancel the docking target, and redock. Confirm there is no invisible toolbar row while floating.
- Check portrait/landscape, light/dark themes, predictive text on/off, safe areas, and command-capsule scrolling.
- Android: repeat with the default keyboard and an alternate keyboard if available.
- Execute built-in and community-plugin commands while preserving editor selection and focus; check Insert alias with native autocomplete.
- Disable/re-enable the plugin in both modes and confirm Obsidian's native toolbar is restored.
- Change settings, reload the plugin, and restart Obsidian to verify persistence. Also test desktop with Show on desktop on/off.

## Publication checklist

The existing public repository is confirmed. Publish the final source and a matching `0.1.18` tag with individual `main.js`, `manifest.json`, and `styles.css` attachments. Address Community directory review results if submission is still needed.

The local ZIP is a sideload artifact, not a replacement for the individual GitHub release attachments. Existing 0.1.17 artifacts are retained as historical packages; they do not match the current source.
