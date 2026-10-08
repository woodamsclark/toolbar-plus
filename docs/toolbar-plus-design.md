# toolbar+ design document

**Implementation baseline:** 0.1.19 (`toolbar-plus` plugin ID), targeting Obsidian 1.13.7 and later.

**Current refactor proposal:** [`native-toolbar-host-refactor.md`](native-toolbar-host-refactor.md) documents the implementation-ready correction for native-host ownership, reparented CSS, rendered visual coverage, and the unresolved physical-device clearance failure.

## 1. Product intent

toolbar+ is a mobile-first command surface for Obsidian. It turns the small area at the bottom of the editor into two complementary ways to act:

- a **docked toolbar** for visible, repeatable commands;
- a **floating eight-direction launcher** for quick, eyes-light interactions.

The nine-dot control is the bridge between those states. It is deliberately a tactile object rather than another menu button: tap it to configure commands, move it immediately when floating to choose a direction, swipe down when docked to hide the keyboard, or hold it to place/detach it.

toolbar+ invokes Obsidian commands; it does not recreate editor behavior. This lets it expose built-in and installed-plugin commands without owning their semantics.

## 2. Experience model

### 2.1 Two persistent layouts

| Layout   | Purpose                                                               | Visible content                                                                                        | Primary interaction                                                                                       |
| -------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Docked   | Keep common commands immediately available above the mobile keyboard. | Configured commands in a scrolling theme-adaptive capsule plus the separate circular nine-dot control. | Tap a command; tap to configure; swipe down to hide the keyboard; hold to detach.                         |
| Floating | Put one movable control wherever it is easiest to reach.              | The circular nine-dot control only. The docked capsule is hidden.                                      | Drag immediately in a direction to invoke its binding; hold to move; hold over the bottom target to dock. |

The saved `mode` selects the active layout. The floating position is stored as a normalized viewport coordinate so it can be restored sensibly across screen sizes and orientation changes.

### 2.2 Default floating map

The default map is an actual spatial contract, not a prose list:

| ↖ Undo         | ↑ Command palette    | ↗ Redo     |
| -------------- | -------------------- | ---------- |
| ← Previous tab | • Configure / cancel | → Next tab |
| ↙ Copy         | ↓ Toggle keyboard    | ↘ Paste    |

The center is not a command. Moving back inside the gesture-distance threshold cancels a floating gesture on release.

### 2.3 Default docked commands

New installations start with, left to right: Undo, Redo, Insert link, Set heading, Toggle checklist status, Indent list, Unindent list, and Command palette. The docked list and floating map are independent; changing one never changes the other.

## 3. Interaction contract

### 3.1 Nine-dot control gesture resolution

On pointer down, toolbar+ begins a pending interaction and captures the pointer. It resolves the interaction by priority:

1. **Hold**: after the configured delay, become a placement drag.
2. **Movement before the hold delay**:
   - while floating, become an eight-way command gesture;
   - while docked, become a keyboard gesture.
3. **Release while still pending**: open the command-layout editor.

Only one interaction exists at a time. Escape, pointer cancellation, window blur, hidden document, viewport resize, and active-pane changes cancel it and restore the mode and position from before the interaction.

### 3.2 Floating command gesture

An immediate floating drag measures the vector from the original pointer position. Once its length reaches the configurable threshold, it resolves to the nearest of eight 45-degree sectors and highlights that sector in the optional 3×3 grid. Release executes the selected binding once. An unassigned direction produces an explanatory notice; a missing or context-inapplicable Obsidian command also produces a notice rather than failing silently.

The grid is feedback, not a second input surface. It is bounded to the visual viewport (maximum 252 px) so it remains usable in landscape and with the keyboard open.

### 3.3 Docked keyboard gesture

An immediate downward drag from the docked control resolves only to the south sector. On release, toolbar+ runs Obsidian's `editor:toggle-keyboard` command; if unavailable, it blurs the active Markdown editor. Other docked drag directions do nothing. This preserves the docked layout and does not consume a configurable gesture slot.

### 3.4 Placement and docking

Holding the control begins a move after the configured hold delay and gives one best-effort haptic pulse.

- From **docked**, release anywhere to detach into floating mode. There is intentionally no drop target.
- From **floating**, a `Dock toolbar` target is available at the bottom. Releasing over it switches to docked mode; otherwise the control remains floating at its new normalized position.

During a floating drag, the docking target temporarily lives in Obsidian's mobile toolbar container when that container is present and open. This keeps the target keyboard-aware. During a docked drag, the toolbar bar is temporarily moved out of the native host so the pointer can remain active while the control changes DOM parent.

## 4. User configuration

### 4.1 Command-layout editor

Tapping the nine-dot control or invoking **toolbar+: Configure toolbar and gestures** opens a compact modal with two keyboard-accessible tabs.

| Tab      | Capabilities                                                                                                                |
| -------- | --------------------------------------------------------------------------------------------------------------------------- |
| Docked   | Add up to 40 command buttons, change each command, choose its icon, reorder it left/right with move controls, or remove it. |
| Floating | Assign or clear each of the eight directional command bindings in a literal 3×3 grid.                                       |

Command selection uses Obsidian's command registry, including commands provided by enabled community plugins. Icon selection uses the installed Obsidian icon list. A toolbar+ command (such as Insert alias) is therefore assignable exactly like other commands.

### 4.2 Settings page

The normal **Settings → toolbar+** page intentionally keeps general behavior separate from command editing.

| Setting          | Default | Range / effect                                                         |
| ---------------- | ------- | ---------------------------------------------------------------------- |
| Command layouts  | —       | Opens the modal editor.                                                |
| Control position | Docked  | Switches immediately between docked and floating modes.                |
| Gesture grid     | On      | Shows the directional feedback grid while floating.                    |
| Haptic feedback  | On      | Best-effort vibration on direction selection and long hold.            |
| Show on desktop  | Off     | Enables the control for mouse or trackpad on desktop in either layout. |
| Hold to move     | 450 ms  | 300–1200 ms, in 50 ms steps.                                           |
| Gesture distance | 28 px   | 16–80 px, in 2 px steps.                                               |

### 4.3 Commands exposed to Obsidian

toolbar+ registers four Command Palette commands:

| Command                        | Purpose                                                             |
| ------------------------------ | ------------------------------------------------------------------- |
| Configure toolbar and gestures | Recovery and configuration entry point.                             |
| Insert alias                   | Creates a wikilink with the current selection as its display alias. |
| Dock toolbar                   | Switches directly to docked mode.                                   |
| Float gesture control          | Switches directly to floating mode.                                 |

## 5. Insert alias

**Insert alias** makes link creation faster without replacing Obsidian autocomplete.

1. It reads the selection as the prospective display label.
2. It replaces that selection with `[[|label]]` and places the caret immediately after `[[` so the user can type or select the target.
3. It temporarily tracks that editor and link.
4. If an autocomplete path replaces the whole wikilink and drops the alias, toolbar+ reinserts only `|label` before the closing brackets, then stops tracking.

Empty selections are valid and create `[[|]]`. Multiline selections and selections containing `]]` are rejected before any editor mutation, because they cannot make a valid single-line wikilink alias. Tracking is per editor (`WeakMap`) and one-shot, so it does not affect later editing or unrelated editors.

## 6. Visual and accessibility design

- The docked commands use Obsidian's native mobile geometry and theme-adaptive surface in a rounded capsule; the nine-dot handle occupies its own circular trailing bubble. The separation signals that commands and mode/gesture control have different roles.
- The floating state removes the capsule and retains a 48 px circular control, positioned within viewport and safe-area bounds.
- The command grid labels and icons describe the currently assigned binding; selected cells use Obsidian's accent color.
- The configuration modal is capped for narrow screens, uses compact rows, and keeps labels and controls aligned.
- Command buttons, handle, tabs, icon buttons, and modal controls have labels/titles or focus-visible styling. Tabs use tablist/tabpanel semantics and support Left/Right/Home/End navigation.
- A screen-reader live region announces selected gesture directions and placement state.
- Reduced-motion users receive no toolbar transition. Haptics are optional and failures are ignored.

## 7. Architecture

```text
Obsidian lifecycle / workspace / viewport events
                    |
                    v
          ToolbarPlus (src/main.ts)
       /       |          |          \\
      v        v          v           v
  DOM hosts  interaction  command    persistence
  + CSS      state machine registry   SettingsWriter
      |           |          |           |
      v           v          v           v
.mobile-toolbar  Config    Obsidian     plugin data.json
or overlay root  (model)   command/API
                    |
                    v
       InsertAliasController (editor-change)
```

### 7.1 Main plugin controller

`ToolbarPlus` owns lifecycle, mounting, rendering, interaction state, command execution, modal/picker lifetime, and layout.

- It mounts one `.toolbar-plus` root, a toolbar bar, the nine-dot handle, gesture grid, docking target, and live status element.
- It uses one `Component` child to centralize DOM/listener cleanup.
- It only schedules layout work for meaningful viewport, focus, active-leaf, layout, native-toolbar insertion/removal, and keyboard-class changes. It does not poll or maintain an idle animation loop.
- It closes modals and pickers, cancels pointers and animation frames, removes its native-toolbar replacement class, and removes the root during unload.

### 7.2 Docked native host and floating overlay

On mobile in docked mode, toolbar+ appends its bar inside Obsidian's `.mobile-toolbar` container. Its command region and trailing handle mirror the native mobile toolbar structure, sizing hooks, and theme surfaces. CSS hides the native container's original children while leaving the host alive, letting Obsidian continue to manage keyboard position and animation.

When docking with the keyboard hidden, the selected docked mode is saved but the toolbar stays hidden until Obsidian reopens its native toolbar. Detached native toolbar and spacer elements must not be reinserted while the keyboard is closed, including during unload. On iOS, `mod-toolbar-open` follows editor focus and may remain set after keyboard hide; native keyboard lifecycle events and the root `--keyboard-height` property gate visibility and restoration. A hidden docked state suppresses both the native row and spacer. Floating app-height compensation also requires an open keyboard. Obsidian owns their reattachment when the keyboard opens.

In floating mode, the bar returns to toolbar+'s own fixed overlay and the suppressed native mobile-toolbar host is collapsed so it reserves no editor height. Holding the floating control temporarily restores that host only when it is available as the keyboard-aware docking target; cancelling or placing the control outside the target collapses it again. On desktop, the native host is not used; visibility is controlled by the `Show on desktop` setting and active Markdown view.

The layout reads `window.visualViewport` where available. Fixed coordinates use visual-viewport-local positioning; safe-area padding and bounds clamp the control so it remains reachable through resize, rotation, and keyboard changes.

### 7.3 Command compatibility

Obsidian's runtime command registry is not fully represented in public typings, so access is isolated behind guarded lookup helpers. toolbar+ supports both `listCommands`/`findCommand` methods and the registry command map. It augments the command list with local public-API implementations of Undo and Redo, since those may be absent from the palette registry in the validated Obsidian version.

Execution first uses `executeCommandById`; Undo and Redo fall back to `MarkdownView.editor.undo()` and `.redo()`. All registry, icon, vibration, pointer-capture, and editor failures are contained so an integration change does not leave a stuck interaction.

### 7.4 Configuration model and persistence

`src/model.ts` defines version-1 configuration:

```ts
interface Config {
  version: 1;
  mode: "docked" | "floating";
  position: { x: number; y: number };
  docked: Binding[];
  gestures: Record<Direction, Binding>;
  haptics: boolean;
  showGrid: boolean;
  desktop: boolean;
  holdMs: number;
  threshold: number;
}
```

`normalize()` treats persisted data as untrusted: it supplies defaults, validates bindings, clamps position and numeric values, caps docked commands at 40, and preserves intentional empty bindings. Unknown future data versions are not overwritten. If settings cannot be read, toolbar+ runs on temporary defaults, warns the user, and prevents writes until a reload protects the existing synced data.

`SettingsWriter` deep-copies snapshots, allows one in-flight save and one latest pending save, and rejects new edits at unload while draining the final pending snapshot. This avoids an unbounded queue of obsolete writes during slider changes while preserving the most recent change.

## 8. Boundaries and non-features

- No network requests, telemetry, accounts, analytics, background polling, or continuous animation loop.
- No reimplementation of Obsidian/editor commands; providers retain their own context and effects.
- No contextual layouts, multiple command profiles, nested gestures, or adaptive suggestions in the current implementation.
- No claim of universal mobile compatibility: `.mobile-toolbar` and the runtime command registry are compatibility-sensitive Obsidian integration points.
- No guarantee that device-specific autocomplete behavior is identical to simulated behavior; Insert alias has automated coverage, but physical iOS/Android autocomplete remains a release acceptance check.

## 9. Validation and release contract

### Automated checks

`npm run check` performs type checking, builds the production bundle, runs Node/jsdom tests, and verifies that the checked-in `main.js` exactly matches the source build. Coverage includes sector selection, center cancellation, tap/hold/swipe precedence, detach/redock, cancellation, viewport clamping, keyboard lifecycle, registry variants, settings recovery/coalescing, unload cleanup, and Insert alias completion paths.

`npm run build:preview` produces a browser-only interaction fixture from the real toolbar+ components and a minimal Obsidian substitute. It demonstrates behavior but does not prove real Obsidian integration.

### Runtime and packaging

The production bundle targets ES2018 and has Obsidian as its only runtime external. A release contains exactly `main.js`, `manifest.json`, and `styles.css`; `npm run release` validates these, packages a sideload ZIP, and writes SHA-256 checksums. Plugin data and vault content are not packaged.

### Required device acceptance

Before presenting a build as mobile-released, verify on real iOS and Android devices:

- docked keyboard hide/reopen, detach, float, redock, rotation, safe areas, and predictive-text/alternate keyboard behavior;
- command execution for built-in and community-plugin commands while preserving editor selection and keyboard focus;
- desktop mouse/trackpad behavior with `Show on desktop` on and off;
- persisted settings after plugin reload and Obsidian restart;
- Insert alias with native autocomplete on the physical device.

## 10. Source map

| File                          | Responsibility                                                                                     |
| ----------------------------- | -------------------------------------------------------------------------------------------------- |
| `src/main.ts`                 | Plugin lifecycle, UI, input state machine, settings/modal UI, and command integration.             |
| `src/mobile-toolbar-host.ts`  | Native mobile host discovery, state selection, DOM ownership, replacement, and restoration.        |
| `src/viewport-layout.ts`      | Pure viewport bounds, normalized placement, clamping, toolbar, and docking-target geometry.        |
| `src/model.ts`                | Config schema, defaults, normalization, clamps, and direction calculation.                         |
| `src/insert-alias.ts`         | Alias insertion and short-lived autocomplete recovery.                                             |
| `src/settings-writer.ts`      | Coalesced, safe asynchronous plugin-data saves.                                                    |
| `styles.css`                  | Docked/floating surfaces, interaction feedback, modal/editor, responsive and reduced-motion rules. |
| `tests/`                      | Model, host transitions, viewport math, lifecycle, persistence, alias, and rendered fixture.       |
| `scripts/verify-build.mjs`    | Metadata/build/runtime-dependency consistency verification.                                        |
| `scripts/package-release.mjs` | Three-file release packaging and SHA-256 manifest generation.                                      |
