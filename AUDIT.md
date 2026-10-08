# toolbar+ 0.1.19 release audit

Audit date: 2026-10-08

## Result

Version 0.1.19 fixes a reported iPhone regression: floating, hiding the keyboard, then docking resurrected Obsidian's native toolbar and spacer at the bottom of the screen. The initial restoration guard was insufficient on iPhone because `mod-toolbar-open` can remain set after keyboard hide. The updated fix uses keyboard lifecycle events and height, suppresses the native row in a hidden docked state, and scopes app-height compensation to the open keyboard. Regression tests reproduced both failure paths before their fixes. iPhone verification of 0.1.19 is pending. Android remains untested; the user previously accepted that limitation. Version 0.1.18 is already published; 0.1.19 is a local release candidate.

## Automated validation

- TypeScript passes and all 53 behavior, lifecycle, settings, and persistence tests pass.
- Installed `main.js` exactly matches the source build.
- Manifest, package lock, package metadata, and `versions.json` agree on version 0.1.19 and minimum Obsidian 1.13.7.
- The runtime bundle imports only `obsidian`, with no Node.js, Electron, or development-package imports.
- Release packaging verifies each runtime file and ZIP entry against the current build. The ZIP contains exactly `main.js`, `manifest.json`, and `styles.css` inside the `toolbar-plus` folder.
- Settings writes are serialized and coalesced. Unload rejects new edits while allowing the latest queued snapshot to drain, including after a failed earlier write. Regression coverage exercises both the writer and plugin unload.
- An abrupt app/process termination can still interrupt asynchronous persistence; synchronous plugin unload cannot guarantee completion before process exit.
- A fresh dependency audit reports three development-dependency warnings: moderate findings for `moment` / the Obsidian SDK and a high finding for `source-map-js`. These packages are not bundled into the plugin; the runtime imports only the host-provided `obsidian` API. Development dependency updates remain separate maintenance work.

- Keyboard-hidden docking and unload leave the native toolbar and spacer detached. Reopening the keyboard lets Obsidian reattach them and restores the docked plugin toolbar. Tests cover both host ownership and the full plugin lifecycle.

## Compatibility boundaries

The native `.mobile-toolbar` / `.mobile-toolbar-spacer` selectors, keyboard body class, and runtime command registry are internal Obsidian integration points. Host ownership is isolated in `MobileToolbarHost`; DOM/lifecycle tests cover host transitions, cleanup, command availability, keyboard events, and viewport geometry.

Floating mode detaches native toolbar and spacer elements and applies a scoped app-container height adjustment. These operations require real-device validation with the final build.

The browser preview loads production styles and displays layout measurements against a simulated keyboard. It does not provide automated rectangle assertions or establish real iOS/Android keyboard behavior.

## Device acceptance status

- iPhone: initial 0.1.18 smoke check passed, then a keyboard-hidden docking regression was reported. The 0.1.19 fix requires a repeat of that exact sequence on iPhone.
- Android: untested; user accepts release without an Android check.

## Additional device checks

After the 0.1.19 runtime files finish syncing and the plugin is reloaded:

- iPhone: dock, hide/reopen the keyboard, detach, type to the keyboard boundary, reveal/cancel the docking target, and redock. Confirm there is no invisible toolbar row while floating.
- Check portrait/landscape, light/dark themes, predictive text on/off, safe areas, and command-capsule scrolling.
- Android: repeat with the default keyboard and an alternate keyboard if available.
- Execute built-in and community-plugin commands while preserving editor selection and focus; check Insert alias with native autocomplete.
- Disable/re-enable the plugin in both modes and confirm Obsidian's native toolbar is restored.
- Change settings, reload the plugin, and restart Obsidian to verify persistence. Also test desktop with Show on desktop on/off.

## Publication checklist

The existing public repository is confirmed. Publish the final source and a matching `0.1.19` tag with individual `main.js`, `manifest.json`, and `styles.css` attachments. Address Community directory review results if submission is still needed.

The local ZIP is a sideload artifact, not a replacement for the individual GitHub release attachments. Existing 0.1.17 artifacts are retained as historical packages; they do not match the current source.
