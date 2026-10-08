# toolbar+

A customizable mobile toolbar that transforms into a floating eight-direction gesture pad for your favorite commands.

<img src="docs/media/toolbar-plus-demo.gif" alt="Toolbar+ on mobile: detach the control, use directional gestures, and dock it again." width="320">

## Start using it
On mobile, open a Markdown note to see the docked toolbar. On desktop, open **Settings → toolbar+** and enable **Show on desktop** to try it with a mouse or trackpad.

- **Tap the nine-dot handle:** configure visible commands, icons, ordering, and gesture bindings.
- **While docked, swipe down immediately:** hide the keyboard while leaving toolbar+ in docked mode.
- **Hold while docked:** detach the control, then release wherever you want to place it. No drop target appears.
- **While floating, drag immediately:** select one of eight directional commands and release to execute. Return within the center threshold before releasing to cancel.
- **Hold while floating and drag to the bottom target:** release to dock the control.
- **Escape, an interrupted touch, or changing the active pane:** cancel the current interaction.

The Command Palette also offers **toolbar+: Configure toolbar and gestures**, **Insert alias**, **Dock toolbar**, and **Float gesture control**. Select text and run **Insert alias** to create `[[|selected text]]`; choose a note from Obsidian's autocomplete to finish `[[Note title|selected text]]`. The same command can be assigned to a docked button or floating gesture.

## Floating gesture defaults

These are the eight-direction gesture bindings used for new installations. Existing installations keep their saved bindings.

| ↖ Undo         | ↑ Command palette    | ↗ Redo         |
| -------------- | -------------------- | -------------- |
| ← Previous tab | • Handle / configure | → Next tab     |
| ↙ Copy         | ↓ Toggle keyboard    | ↘ Paste        |

Commands use Obsidian command IDs, including commands from enabled community plugins. A command that has been removed, disabled, or is unavailable in the current context produces a notice. toolbar+ does not reimplement editor commands.

Settings include grid visibility, optional vibration, hold duration (300–1200 ms), and gesture distance (16–80 px). toolbar+ saves mode, normalized floating position, and configuration in its local `data.json`. Viewport and safe-area bounds keep the floating handle reachable.


## Compatibility

Version **0.1.20** requires Obsidian 1.13.7 or later. The docked toolbar slides upward during keyboard opening, then returns to Obsidian’s native toolbar at completion. The slide and keyboard-hidden docking were verified on iPhone by the user. Android has not been tested.

Settings support Obsidian’s settings search. Tagged releases publish only `main.js`, `manifest.json`, and `styles.css`, with GitHub artifact attestations for their provenance.

## License

toolbar+ is licensed under the [Mozilla Public License 2.0](LICENSE).
