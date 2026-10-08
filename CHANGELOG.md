# Changelog

## 0.1.20 — Obsidian checker compatibility

- Slide a hidden docked toolbar upward during keyboard opening when the event supplies a valid height, then hand it back to the native row on `keyboardDidShow`. Keep native rows suppressed during the slide, clear interrupted entrances, preserve visible toolbars during frame changes, and honor reduced motion. Start even when iOS has not created its native toolbar yet. The 380ms entrance approximates the observed iPhone opening interval and was verified by the user on iPhone.

- Use Obsidian CSS helpers for runtime positioning and window-qualified frame/timer APIs.
- Expose all settings to Obsidian settings search through declarative definitions, retaining plugin-owned persistence and immediate desktop visibility changes.
- Show slider values inline and remove an unnecessary type assertion.
- Replace `!important`, `:has`, `display: contents`, and `clip-path` with scoped selectors and compatible layout rules; retain 42px docked and 48px floating controls.
- Add a tag-triggered GitHub release workflow that builds, validates, and attests the three supported Obsidian assets; keep ZIPs and checksums local.
- Align the live source with the released 0.1.19 keyboard fixes before rebuilding.

## 0.1.19 — keyboard-hidden docking

- Keep Obsidian's native toolbar and spacer detached when docking or unloading after hiding the keyboard in floating mode.
- Use native keyboard show/hide events and `--keyboard-height` alongside the native toolbar marker; on iOS the marker can stay set after the keyboard retracts.
- Suppress the native row while docked with the keyboard hidden, and honor the bar's hidden attribute after reparenting.
- Apply floating app-height compensation only while the keyboard is open.
- Restore the native row when the keyboard reopens.
- Extend regression coverage to native row connectivity, not only toolbar+ visibility.
- The user verified the updated fix on iPhone. Android remains untested.

## 0.1.18 — release consistency and final settings saves

- Preserve the latest queued settings snapshot when the plugin unloads, including after a failed earlier save. Reject new edits after unload.
- Package the current native-toolbar host and viewport refactor, floating keyboard-clearance changes, and 42px docked toolbar.
- Align the manifest, package metadata, compatibility map, release documentation, and runtime assets.
- Verify packaged runtime files and ZIP contents against the source build.
- iPhone visual smoke check passed according to the user. Android is untested; release proceeds with that known limitation.

## 0.1.16 — floating gesture defaults

- Set the eight floating gesture defaults to the current toolbar+ layout: undo, command palette, redo, previous tab, next tab, copy, keyboard toggle, and paste.
- Keep the docked toolbar defaults independent from the floating gesture layout.

## 0.1.15 — compact settings

- Replace oversized mobile settings cards with a compact, flat settings list.
- Align labels and controls in consistent columns and constrain slider width.
- Shorten behavior descriptions for faster scanning on narrow screens.

## 0.1.14 — reliable long-hold detachment

- Track active pointer movement and release at the document level so a docked drag survives moving toolbar+ out of Obsidian's native toolbar host.
- Reacquire pointer capture after the host change when the mobile WebView supports it.
- Keep long-hold feedback to one toolbar+ haptic pulse and cover the interrupted-capture path in the lifecycle tests.

## 0.1.13 — floating replacement and keyboard-aware target

- Keep Obsidian's original mobile toolbar suppressed while toolbar+ is floating.
- Host the docking target in Obsidian's keyboard-aware toolbar container while dragging a floating control, keeping it visible above the keyboard.
- Restore the target to toolbar+'s overlay after docking, cancellation, or interrupted input.

## 0.1.12 — native dock host

- Host toolbar+ directly inside Obsidian's mobile-toolbar container while docked, letting Obsidian own keyboard placement and animation.
- Hide only the native toolbar contents instead of hiding its positioned container.
- Move the same toolbar+ control back to its independent overlay when floating, hidden, configuring, or unloading.

## 0.1.11 — iOS fixed-coordinate correction

- Position the fixed docked bar in visual-viewport-local coordinates instead of adding `offsetTop` and `offsetLeft` a second time.
- Add coverage for the nonzero viewport offsets reported by iOS while the keyboard is open.

## 0.1.10 — visual viewport docking

- Use the visual viewport bottom as the only source of docked position on iOS and Android.
- Stop copying or tracking the native Obsidian toolbar's animated rectangle; retain it only as the docked visibility signal.
- Smooth viewport-driven position changes with a short transition that respects reduced-motion preferences.
- Remove the keyboard animation frame tracker and native resize observer.

## 0.1.9 — direct docked keyboard gesture

- Hide the keyboard with an immediate downward swipe on the docked tactile control, without consuming a configurable command slot.
- Make a docked long hold detach the control directly and never show a bottom target.
- Show the docking target only when moving a control that was already floating.
- Follow the native toolbar's changing position on every animation frame for one second after keyboard activity, covering late iOS movement that resize observation cannot detect.

## 0.1.8 — contextual bottom target

- Show `Hide keyboard` on the move target when the control started docked, run Obsidian's keyboard-toggle command with an editor-blur fallback, and keep the toolbar docked after release.
- Keep `Dock toolbar` as the target action when the control started floating.
- Preserve the saved floating position when hiding the keyboard so transient keyboard geometry is never persisted as a position.

## 0.1.7 — dock positioning fix

- Anchor the docked replacement to the native toolbar's measured top edge instead of deriving a bottom inset across different iOS viewport coordinate systems.
- Clamp the complete toolbar inside the visual viewport while the keyboard animates or reports a transient off-screen native-toolbar rectangle.

## 0.1.6 — release candidate

- Restore a manually docked toolbar after the keyboard reopens, including the iOS ordering where focus and viewport changes arrive before Obsidian reattaches its native toolbar.
- Run Undo and Redo through Obsidian's public editor API when those actions are absent from the runtime command list.
- Cancel pending settings writes during plugin unload.
- Normalize the public app name to `toolbar+` and use `toolbar-plus` for registry, folder, package, and archive identifiers.

## 0.1.5 — stability release candidate

- Honor desktop visibility in both docked and floating modes.
- React to the keyboard-toolbar body class and toolbar insertion/removal without layout work on every editor DOM update.
- Dispose UI listeners, observers, animation frames, active pointers, configuration modals, and nested pickers on failure or unload; prevent late startup after unload.
- Keep unreadable or newer-version settings from being overwritten with defaults. Coalesce rapid edits into the latest pending save.
- Isolate unsupported pointer capture, optional vibration, and resize observation from command execution.
- Cancel in-progress gestures when the viewport resizes; constrain feedback grids to short landscape viewports.
- Prefer direct command lookup to repeated enumeration.
- Add keyboard tab navigation, accessible tab/panel relationships, and an Edit commands entry in the normal settings page.
- Preserve the two-pill toolbar and separate Docked/Floating command editor. Remove obsolete CSS and center command icons consistently.
- Add a repeatable release check and three-file ZIP package with SHA-256 hashes.

This candidate still requires the device acceptance checks listed in AUDIT.md before a broad production release.

## 0.1.4

- Separate command editing into Docked/Floating tabs; move behavior controls to Obsidian settings.

## 0.1.0–0.1.3

- Initial docked toolbar, detachable gesture control, persistent configuration, mobile startup fixes, and native-style two-pill layout.
