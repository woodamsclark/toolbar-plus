# toolbar+ 0.1.20 release audit

Audit date: 2026-10-08

## Result

The local 0.1.20 build addresses the supplied Obsidian checker feedback. The source includes the released 0.1.19 keyboard lifecycle and hidden-docking fixes, which were missing from the live source while its generated bundle was current. The public repository and 0.1.19 release were inspected on 2026-10-08. Version 0.1.20 is published. GitHub Actions run [37836603899](https://github.com/woodamsclark/toolbar-plus/actions/runs/37836603899) passed the build, tests, attestations, and publication. Downloaded release assets exactly match the verified local build, and `gh attestation verify` succeeded independently for all three assets.

The existing 0.1.19 release still has the checker-reported ZIP and checksum attachments. The new workflow uploads only the three supported assets; it does not change historical releases.

## Automated validation

- TypeScript passes and all 62 behavior, lifecycle, settings, and persistence tests pass.
- Installed `main.js` exactly matches the source build.
- Manifest, package lock, package metadata, and `versions.json` agree on version 0.1.20 and minimum Obsidian 1.13.7.
- The runtime bundle imports only `obsidian`, with no Node.js, Electron, or development-package imports.
- Release packaging verifies each runtime file and ZIP entry against the current build. The ZIP contains exactly `main.js`, `manifest.json`, and `styles.css` inside the `toolbar-plus` folder.
- Settings writes are serialized and coalesced. Unload rejects new edits while allowing the latest queued snapshot to drain, including after a failed earlier write. Regression coverage exercises both the writer and plugin unload.
- An abrupt app/process termination can still interrupt asynchronous persistence; synchronous plugin unload cannot guarantee completion before process exit.
- Obsidian's official ESLint plugin 0.4.0 and TypeScript assertion rule report zero findings for the supplied code-rule categories: CSS assignment, window timers, setting definitions, deprecated settings display, and unnecessary assertions. Checker dependencies were installed only in a temporary folder.
- Production CSS contains no `!important`, `:has`, `display: contents`, or `clip-path`; deprecated dynamic slider tooltips are absent from the source.
- Keyboard-opening regression coverage verifies overlay entrance geometry, stable targets through viewport changes, native-row suppression, completion handoff, cancellation, mode/configuration/unload cleanup, invalid-height fallback, and already-open frame changes. The browser fixture measured a monotonic slide from y=844 to y=524 at 390×844, with native rows suppressed until completion.
- Declarative settings tests cover search definitions, plugin-owned persistence, validation bounds, immediate desktop visibility, and command editor / position actions.
- The clean locked dependency install reports three development-dependency vulnerabilities (two moderate, one high). These dependencies are absent from the runtime bundle, which imports only Obsidian.

## Compatibility boundaries

The native `.mobile-toolbar` / `.mobile-toolbar-spacer` selectors, keyboard body class, and runtime command registry are internal Obsidian integration points. Host ownership is isolated in `MobileToolbarHost`; DOM/lifecycle tests cover host transitions, cleanup, command availability, keyboard events, and viewport geometry.

Floating mode detaches native toolbar and spacer elements and applies a scoped app-container height adjustment. These operations require real-device validation with the final build.

The browser preview loads production styles and displays layout measurements against a simulated keyboard. Visual inspection and fixture measurements verify the local CSS at phone size; they do not establish real iOS/Android keyboard behavior.

## Device acceptance status

- Browser preview: checked at 390×844 in light and dark themes. The docked bar, command capsule, and handle measure 42px; the floating handle measures 48×48px, native toolbar rows are detached, and the fixture reports zero editor gap.
- iPhone: the user confirmed that the corrected docked keyboard slide works great. The entrance starts before Obsidian creates its native toolbar and uses a 380ms approximation, based on the observed opening interval. Temporary device-report support was removed before publication. Keyboard-hidden docking was verified previously in 0.1.19.
- Android: untested; the earlier acceptance of this limitation does not establish device coverage for 0.1.20.

## Additional device checks

After the 0.1.20 runtime files finish syncing and the plugin is reloaded:

- iPhone: dock, hide/reopen the keyboard, detach, type to the keyboard boundary, reveal/cancel the docking target, and redock. Confirm there is no invisible toolbar row while floating.
- Check portrait/landscape, light/dark themes, predictive text on/off, safe areas, and command-capsule scrolling.
- Android: repeat with the default keyboard and an alternate keyboard if available.
- Execute built-in and community-plugin commands while preserving editor selection and focus; check Insert alias with native autocomplete.
- Disable/re-enable the plugin in both modes and confirm Obsidian's native toolbar is restored.
- Change settings, reload the plugin, and restart Obsidian to verify persistence. Also test desktop with Show on desktop on/off.

## Publication verification

[Release 0.1.20](https://github.com/woodamsclark/toolbar-plus/releases/tag/0.1.20) contains only `main.js`, `manifest.json`, and `styles.css`. All three downloaded files exactly match the verified local build and passed GitHub attestation verification. The published tag is `a339021`; manual recovery of the release workflow ran from `6d7e4a0`, whose runtime source is identical. The initial tag push did not start a run; the user explicitly approved adding the manual trigger to finish publication without moving the tag.

The workflow validates the version tag, installs locked dependencies, builds/tests/packages, attests the three supported assets, and publishes them. ZIPs and checksums remain local. Historical release attachments are unchanged.
