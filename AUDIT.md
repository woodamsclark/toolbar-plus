# toolbar+ 0.1.15 release audit

Audit date: 2026-09-09

## Result

The code and local release assets are ready for device acceptance. Public Community directory publication remains blocked until the project has a chosen `LICENSE` and a matching GitHub release.

## Completed checks

- TypeScript compiles without errors.
- All 30 automated behavior, lifecycle, settings, and persistence tests pass.
- The installed `main.js` exactly matches a clean source build.
- Manifest, package lock, package metadata, and `versions.json` agree on version 0.1.15.
- The production bundle imports only `obsidian`; it contains no Node.js, Electron, development, network, telemetry, or self-update dependency.
- `npm audit` reports zero known vulnerabilities across 81 development dependencies.
- Rapid settings edits are coalesced; pending writes stop on unload.
- DOM listeners, workspace events, observers, pointer state, animation frames, modals, and pickers are released on unload.
- The keyboard regression covers this order: float, hide keyboard, manually dock, begin keyboard reopen, reattach native toolbar, restore toolbar+.
- Docked toolbar+ is hosted inside Obsidian's positioned `.mobile-toolbar`; it performs no independent keyboard-position calculation.
- The native toolbar's original children remain hidden while toolbar+ is active in either mode. The container remains active and owns the keyboard transition.
- Floating mode moves toolbar+ back to its own root while keeping the original mobile toolbar suppressed; configuration and unload restore the native contents.
- The floating-mode docking target temporarily uses the native toolbar container, keeping the target above the keyboard, and returns to toolbar+'s root after every completed or cancelled interaction.
- A downward swipe on the docked tactile control uses Obsidian's keyboard-toggle command, falls back to the public editor API, and leaves the toolbar mode docked.
- A docked long hold detaches without exposing a drop target; the target is available only for docking an already-floating control.
- Document-level pointer tracking and post-transfer capture keep that drag active while the docked control moves out of Obsidian's native toolbar host; the hold requests one haptic pulse.
- The settings page uses compact, flat rows with aligned controls and bounded slider widths on mobile.
- Undo and Redo fall back to Obsidian's public editor API because Obsidian 1.13.7 omits those actions from its command list.
- Desktop opt-out applies to docked and floating states.
- The public display name is `toolbar+`; registry, folder, package, and archive identifiers use `toolbar-plus`.
- `toolbar-plus` and `toolbar+` were not present in the current public Community plugins registry when checked.

## Compatibility boundaries

toolbar+ integrates with two Obsidian surfaces that do not have equivalent public APIs: the runtime command registry and the `.mobile-toolbar` element. Both are isolated behind guarded lookups and failure handling, but an Obsidian UI or internal registry change can require a compatibility update.

Version 0.1.15 declares Obsidian 1.13.7 as its minimum because that is the validated local baseline. Lower Obsidian versions have not been claimed compatible.

## Required device acceptance

Run these checks with the packaged 0.1.15 assets after they finish syncing:

- iOS: swipe down on the docked tactile control to hide the keyboard, reopen it, then hold to detach and confirm no target appears. Rotate in both modes and test predictive text on and off.
- Android: repeat the same sequence with the default keyboard and one alternate keyboard if available.
- Desktop: enable Show on desktop, test docked and floating input with mouse or trackpad, then disable it and confirm the control disappears.
- All platforms: reload the plugin, restart Obsidian, execute built-in and community-plugin commands, open and close both command pickers, and confirm settings persist.

## Public release blockers

1. Choose and add a recognized open-source `LICENSE`. Obsidian requires this for Community directory publication.
2. Publish a GitHub release tagged `0.1.15` and attach `main.js`, `manifest.json`, and `styles.css` as individual assets.
3. Run the Community directory preview scan, resolve any reported errors, and submit the repository through the Community directory.

The ZIP in `releases/0.1.15` is a convenient sideload artifact. Obsidian's Community release still requires the three runtime files as separate GitHub release assets.
