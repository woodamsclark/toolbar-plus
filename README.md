# toolbar+

## Start using it
On mobile, open a Markdown note to see the docked toolbar. On desktop, open **Settings → toolbar+** and enable **Show on desktop** to try it with a mouse or trackpad.

- **Tap the nine-dot handle:** configure visible commands, icons, ordering, and gesture bindings.
- **While docked, swipe down immediately:** hide the keyboard while leaving toolbar+ in docked mode.
- **Hold while docked:** detach the control, then release wherever you want to place it. No drop target appears.
- **While floating, drag immediately:** select one of eight directional commands and release to execute. Return within the center threshold before releasing to cancel.
- **Hold while floating and drag to the bottom target:** release to dock the control.
- **Escape, an interrupted touch, or changing the active pane:** cancel the current interaction.

The Command Palette also offers **toolbar+: Configure toolbar and gestures**, **Dock toolbar**, and **Float gesture control**. These provide recovery controls if you need to reset the mode.

## Defaults

| Northwest   | North                  | Northeast       |
| ----------- | ---------------------- | --------------- |
| Undo        | Command palette        | Redo            |
| Previous tab| Handle / configuration | Next tab        |
| Copy        | Toggle keyboard        | Paste           |

Commands use Obsidian command IDs, including commands from enabled community plugins. A command that has been removed, disabled, or is unavailable in the current context produces a notice. toolbar+ does not reimplement editor commands.

Settings include grid visibility, optional vibration, hold duration (300–1200 ms), and gesture distance (16–80 px). toolbar+ saves mode, normalized floating position, and configuration in its local `data.json`. Viewport and safe-area bounds keep the floating handle reachable.


## License

toolbar+ is licensed under the [Mozilla Public License 2.0](LICENSE).
