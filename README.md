# toolbar+

A mobile-first Obsidian toolbar that detaches into an eight-direction gesture launcher.

Current local build: **0.1.16** for Obsidian 1.13.7 and later. The tactile-control modal edits commands only and separates the Docked and Floating layouts into two tabs. General behavior and positioning live in Obsidian's compact toolbar+ settings page. The docked toolbar mirrors Obsidian's native mobile layout: commands sit in a black capsule and the tactile control occupies a separate circular button at the right. While docked, toolbar+ is hosted directly inside Obsidian's native mobile-toolbar container, so Obsidian owns its keyboard placement and animation. Floating mode moves the same control back into toolbar+'s independent overlay while keeping Obsidian's original mobile toolbar suppressed. A downward swipe on the docked tactile control hides the keyboard directly. Holding it detaches the control without showing a drop target; pointer tracking remains active while the control changes hosts. The docking target appears only when moving an already-floating control and temporarily uses Obsidian's keyboard-aware toolbar position. Mobile command-registry and browser API differences remain guarded, unreadable synced settings fall back to defaults, and the bundle targets ES2018.

## Start using it

The compiled plugin is already in this vault's `.obsidian/plugins/toolbar-plus` folder. In **Settings → Community plugins**, refresh the installed list and enable **toolbar+**. If it does not appear, restart Obsidian.

On mobile, open a Markdown note to see the docked toolbar. On desktop, open **Settings → toolbar+** and enable **Show on desktop** to try it with a mouse or trackpad.

- **Tap the nine-dot handle:** configure visible commands, icons, ordering, and gesture bindings.
- **While docked, swipe down immediately:** hide the keyboard while leaving toolbar+ in docked mode.
- **Hold while docked:** detach the control, then release wherever you want to place it. No drop target appears.
- **While floating, drag immediately:** select one of eight directional commands and release to execute. Return within the center threshold before releasing to cancel.
- **Hold while floating and drag to the bottom target:** release to dock the control.
- **Escape, an interrupted touch, or changing the active pane:** cancel the current interaction.

The Command Palette also offers **toolbar+: Configure toolbar and gestures**, **Dock toolbar**, and **Float gesture control**. These provide recovery controls if you need to reset the mode.

## Floating gesture defaults

These are the eight-direction gesture bindings used for new installations. Existing installations keep their saved bindings.

| Northwest (↖) | North (↑)              | Northeast (↗) |
| -------------- | ---------------------- | -------------- |
| Undo           | Command palette        | Redo           |
| Previous tab   | Handle / configuration | Next tab       |
| Copy           | Toggle keyboard        | Paste          |

Commands use Obsidian command IDs, including commands from enabled community plugins. A command that has been removed, disabled, or is unavailable in the current context produces a notice. toolbar+ does not reimplement editor commands.

Settings include grid visibility, optional vibration, hold duration (300–1200 ms), and gesture distance (16–80 px). toolbar+ saves mode, normalized floating position, and configuration in its local `data.json`. Viewport and safe-area bounds keep the floating handle reachable.

## Build and validation

Use Node.js 22.13+ (Node 25 was used for this build).

```sh
npm ci
npm run typecheck
npm test
npm run build
```

Ship `main.js`, `manifest.json`, and `styles.css` together. Source lives in `src/`. The bundle has no runtime package dependencies other than Obsidian.

Automated checks cover all eight sectors, center cancellation, tap/hold/swipe priority, detach/redock, interrupted interactions, settings recovery, unavailable commands, viewport clamping, and removal of the replacement native-toolbar class on unload. These run against a simulated DOM and command registry.

`tests/preview.html` is a development fixture using the real toolbar+ components and a minimal Obsidian substitute. It is not part of the shipped plugin; its command execution only displays the selected command ID. To rebuild it:

```sh
npm run build:preview
```

Serve this folder with a local HTTP server, then open `/tests/preview.html`.

## Compatibility and remaining device checks

toolbar+ uses pointer capture and event-driven viewport updates. It uses the existing mobile toolbar as its docked host and preserves that container while hiding its original controls, restoring them when disabled. The native toolbar selector and Obsidian's runtime command registry are compatibility-sensitive integration points. Default command IDs were checked against installed Obsidian 1.13.7.

Before treating this as a mobile release, test on actual iOS and Android devices: keyboard opening/closing, predictive-text bars, safe areas, portrait/landscape rotation, keeping selection and keyboard focus while executing commands, and interactions with other toolbar plugins. Automated DOM checks do not establish device compatibility. Vibration is best-effort and may be unavailable, particularly on iOS.

Live mobile-device verification must be done after the updated `main.js` and `manifest.json` finish syncing to the device.

Contextual layouts, multiple profiles, nested gestures, and adaptive suggestions are intentionally left for later, as described in the supplied specification.

## Privacy

No network requests, telemetry, accounts, or external services. Commands you choose may have their own effects through their providing plugins. There is no idle polling or continuous animation loop.

## License

toolbar+ is licensed under the [Mozilla Public License 2.0](LICENSE).
