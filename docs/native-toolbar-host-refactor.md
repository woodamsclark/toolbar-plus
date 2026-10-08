# Native toolbar host refactor

**Status:** implementation design
**Baseline:** toolbar+ 0.1.17 on Obsidian 1.13.7
**Primary targets:** iPhone portrait and landscape; Android and desktop remain supported

## 1. Problem

The current implementation has two user-visible failures:

1. Floating mode can still leave an invisible row between the editor and the keyboard, so text appears blocked by a toolbar that is no longer visible.
2. The docked nine-dot control does not reliably read as a separate native-style bubble.

The first attempted fix added a collapsed class to Obsidian's `.mobile-toolbar` and adopted Obsidian's internal child class names for Toolbar+ elements. Automated lifecycle tests passed, but the physical device showed no visual improvement.

That attempt exposed two concrete design defects:

- Toolbar+ visual custom properties are declared on `.toolbar-plus`, while the docked bar is reparented outside that root and into `.mobile-toolbar`. CSS inheritance stops at the new parent, so the docked bar loses plugin-owned size, surface, border, and shadow values.
- Host changes are performed by `layout()`, the hold timer, interaction cleanup, mode changes, and unload cleanup. No single component owns the invariant between saved mode, current DOM parent, native-host classes, and docking-target parent.

There is also a validation defect: the jsdom lifecycle fixture does not load `styles.css` or Obsidian's mobile layout CSS. It can prove that a class was added, but it cannot prove that the class removes layout height, that the bubble is circular, or that editor content reaches the keyboard edge.

## 2. Intended result

### Docked

- Toolbar+ occupies the same row, height, safe-area position, and keyboard animation as Obsidian's native mobile toolbar.
- Commands sit in one rounded, horizontally scrolling capsule.
- The nine-dot control sits in a separate circular bubble with the same height as the native keyboard control and an 8 px visual gap from the command capsule.
- Light and dark appearance follow Obsidian theme tokens.

### Floating

- Only the movable nine-dot bubble remains visible.
- No hidden Toolbar+ or Obsidian toolbar element contributes height to the app's flex layout.
- Editor content can extend to the visual keyboard boundary, subject only to Obsidian's own editor and keyboard insets.
- The saved floating position remains normalized to the full placement area and is clamped into the current visual viewport when the keyboard opens.

### Moving and redocking

- Holding a docked control detaches it without showing a target.
- Holding a floating control may temporarily show the docking target at the native toolbar position.
- Cancelling or releasing outside the target returns immediately to the floating state and removes the native host from layout again.

## 3. Architecture

Keep `ToolbarPlus` as the plugin orchestrator, but move mobile-host ownership and viewport geometry out of the main controller.

```text
ToolbarPlus
    |
    +-- MobileToolbarHost          owns every DOM host transition
    +-- ViewportLayout             computes fixed overlay geometry
    +-- pointer interaction        remains in ToolbarPlus
    +-- command/config/persistence remains in existing modules
```

This refactor introduces the host and viewport boundaries. Pointer interaction and element creation remain in `ToolbarPlus` during this change; pointer code must request host transitions instead of moving DOM nodes directly. This keeps the change focused and avoids a one-use DOM factory abstraction.

### 3.1 Stable plugin DOM

`ToolbarPlus.mount()` continues to create and retain stable references to the plugin-owned root, bar, command list, handle slot, handle, gesture grid, docking target, and live status element.

All elements use only plugin-owned `.tp-*` classes. Do not assign `mobile-toolbar-options-container`, `mobile-toolbar-options-list`, `mobile-toolbar-floating-options`, or `mobile-toolbar-option` to Toolbar+ elements. Theme authors legitimately target those internal Obsidian classes with layout rules such as grids, extra padding, or alternate heights; inheriting those rules makes Toolbar+ geometry nondeterministic.

Toolbar+ may depend on the `.mobile-toolbar` host selector because there is no equivalent public API. That dependency remains isolated in `MobileToolbarHost`.

### 3.2 `MobileToolbarHost`

Create `src/mobile-toolbar-host.ts`. It is the only module allowed to:

- query `.mobile-toolbar`;
- add or remove native-host classes;
- append the Toolbar+ bar to the native host;
- return the bar to the overlay root;
- append or restore the docking target;
- hide or restore Obsidian's original toolbar children.

Its public contract is state based:

```ts
type MobileHostState = "restored" | "docked" | "floating" | "dock-target";

interface MobileToolbarHostController {
  reconcile(state: MobileHostState): void;
  refreshNativeHost(): void;
  dispose(): void;
}
```

`reconcile()` is idempotent. Calling it twice with the same state does not move nodes or change classes. When Obsidian detaches one native host and inserts another, `refreshNativeHost()` restores the old host and records the replacement; the same layout pass then reconciles the desired state onto the replacement.

### 3.3 Host-state invariants

| State         | Bar parent                                            | Dock target parent         | Native originals | Native host in layout             |
| ------------- | ----------------------------------------------------- | -------------------------- | ---------------- | --------------------------------- |
| `restored`    | overlay root, hidden as requested by plugin lifecycle | overlay root               | Visible          | Obsidian controlled               |
| `docked`      | native host                                           | overlay root               | Hidden           | Yes                               |
| `floating`    | overlay root                                          | overlay root               | Hidden           | No                                |
| `dock-target` | overlay root                                          | native host when available | Hidden           | Yes, for the duration of the drag |

Additional invariants:

- The bar and target each have exactly one parent.
- At most one connected `.mobile-toolbar` is modified.
- A previously modified native host has all Toolbar+ classes removed before ownership changes.
- `dispose()` restores the native host even if called during an active pointer interaction.
- Desktop mode never modifies `.mobile-toolbar`.

The initial implementation may keep the existing `tp-native-replaced` and `tp-native-collapsed` class names, but only `MobileToolbarHost` may toggle them.

### 3.4 Selecting host state

`ToolbarPlus` derives one desired host state and passes it to the controller:

```ts
function desiredHostState(input: {
  mobile: boolean;
  mode: "docked" | "floating";
  pluginVisible: boolean;
  movingFromDocked: boolean;
  movingFromFloating: boolean;
  nativeToolbarOpen: boolean;
}): MobileHostState;
```

Rules:

- Non-mobile or plugin unload: `restored`.
- Docked with an open native toolbar: `docked`.
- Moving from docked: `floating`, without a docking target.
- Floating placement drag with an available native toolbar: `dock-target`.
- All other mobile floating cases: `floating`.
- Docked while the keyboard/native toolbar is absent: `restored`; the plugin root stays hidden until Obsidian recreates the host.

The `MutationObserver`, keyboard-class observer, viewport listeners, mode changes, and interaction changes all schedule the same reconciliation path. They do not move nodes themselves.

## 4. CSS ownership and native appearance

Reparentable elements must carry the values they need. Define Toolbar+ surface and dimension variables on `.tp-bar` rather than only on `.toolbar-plus`:

```css
.tp-bar {
  --tp-height: 42px;
  --tp-option-width: var(--toolbar-option-width, 40px);
  --tp-surface: var(--interactive-normal, var(--background-secondary));
  --tp-foreground: var(--text-muted);
  --tp-border: var(--background-modifier-border);
  --tp-shadow: var(--shadow-s, 0 3px 14px rgb(0 0 0 / 20%));
}
```

The overlay root continues to own viewport and safe-area values. The bar owns toolbar appearance. The floating handle either inherits from the bar or receives the same component-level variables on `.tp-handle`; it never relies on an ancestor that may change during a gesture.

Use plugin-owned geometry:

- bar height: `--tp-height`;
- command width: `--tp-option-width`;
- handle width and height: `--tp-height`;
- command/handle gap: `8px`;
- outer horizontal inset: `8px`;
- capsule and handle radius: `999px` / `50%`;
- floating pointer target: 48 px.

The docked row explicitly constrains the capsule and tactile bubble to 42px,
including min/max dimensions so Obsidian's mobile button rules cannot inflate
them. The surrounding native keyboard slot remains untouched, leaving the same
small gap above the keyboard as the native toolbar. Floating and moving states
retain a 48px gesture target.

The native toolbar provides placement and animation; Toolbar+ provides the capsule and bubble appearance. This avoids accidental structural styling from third-party themes while retaining Obsidian's theme colors and standard size variables.

`tp-native-collapsed` must remove the native wrapper from flex layout:

```css
.mobile-toolbar.tp-native-collapsed {
  display: none !important;
  flex: 0 0 0 !important;
  height: 0 !important;
  min-height: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
}
```

Floating state also places `tp-mobile-toolbar-collapsed` on the document root.
A document-scoped selector applies the same collapse rules to the current native
host and to any replacement inserted by Obsidian, even when Obsidian performs a
delayed rewrite of the body and native-host class lists during a keyboard
transition. A relational fallback anchored to Toolbar+'s own
`data-tp-host-state="floating"` root provides the same invariant. The host
controller removes the document marker for docked, dock-target, restored, and
disposed states.

Floating mode detaches the native host and Obsidian's separate
`.mobile-toolbar-spacer` from the DOM while retaining their parent and
next-sibling anchors. Docked, dock-target, restored, and disposed transitions
reinsert those exact elements before applying their normal state. If Obsidian
inserts replacement elements during its delayed keyboard lifecycle, the
controller adopts and detaches them too. A document-scoped CSS rule collapses a
new spacer immediately so it cannot flash for a frame before the observer runs.

The redundant zero-size properties make the intent explicit and guard against themes that restore a display or flex rule. They do not replace device verification.

## 5. Viewport geometry

Create `src/viewport-layout.ts` with pure functions for:

- current visual-viewport bounds;
- full placement dimensions;
- normalized-position conversion;
- safe-area clamping;
- dock-target rectangle.

Fixed-position coordinates remain local to the visual viewport. Do not add `visualViewport.offsetTop` or `offsetLeft` to fixed coordinates. Full placement dimensions remain larger than a keyboard-reduced visual viewport so a low saved position rises only when necessary and returns when the keyboard closes.

The layout module returns numbers and rectangles; it does not mutate DOM or choose hosts. `ToolbarPlus` applies its output as inline position variables.

## 6. Resolved keyboard clearance

Do not assume the native wrapper is the only source of clearance. The implementation must collect the following evidence in each state before declaring the issue fixed:

| Measurement                                        | Docked                                 | Floating                                     |
| -------------------------------------------------- | -------------------------------------- | -------------------------------------------- |
| `.mobile-toolbar` computed `display` and rectangle | Visible, one toolbar row               | `display: none`, zero rectangle              |
| Toolbar+ bar rectangle                             | Native toolbar row                     | No command capsule rectangle                 |
| Toolbar+ root rectangle                            | Full viewport, pointer-events disabled | Full viewport, pointer-events disabled       |
| Nine-dot handle rectangle                          | Separate trailing square/circle        | Clamped visible circle                       |
| Active editor bottom                               | Above visible toolbar                  | Reaches keyboard boundary                    |
| Element at the alleged blocked point               | Visible toolbar control                | Editor/content or keyboard, never hidden bar |

Physical-device tracing showed that iOS shortens the app container by one native
toolbar row and Obsidian adds a separate 52px `.mobile-toolbar-spacer`. Floating
mode removes the spacer and extends `.app-container` by
`--mobile-toolbar-height`, scoped to `body.mod-toolbar-open` and the floating
document marker. This lets the active editor reach the keyboard boundary
without globally overriding editor padding.

Add `data-tp-host-state` to the Toolbar+ root and modified native host. This is
a styling and test seam, not persisted configuration. It keeps host-state
selectors aligned with the controller without inferring state from several
classes.

## 7. Validation

### 7.1 Unit and lifecycle tests

Add tests for the pure `desiredHostState()` and viewport functions. Add transition tests covering every meaningful edge:

- restored → docked → floating → dock-target → floating;
- dock-target → docked;
- docked → moving from docked → floating;
- native host removed and replaced in every state;
- unload during docked, floating, and dock-target;
- configuration modal and pointer cancellation during each mode.

Assertions cover DOM ownership, state attributes, and cleanup. These tests do not make visual acceptance claims.

### 7.2 Rendered mobile fixture

Replace the current minimal preview with a fixture that loads:

- `styles.css`;
- a small, checked-in extract of Obsidian's relevant mobile flex and toolbar rules;
- an editor pane, native toolbar, and synthetic keyboard block;
- light and dark theme variables;
- a 393 × 852 iPhone-like viewport and a narrow landscape viewport.

Use a real layout engine to assert computed rectangles:

- docked capsule and bubble are equal height;
- bubble width equals height;
- the gap is 8 px;
- command capsule stays within the viewport and scrolls internally;
- floating native host has zero height;
- no command capsule remains visible in floating mode;
- editor bottom meets the synthetic keyboard top within a 1 px tolerance;
- no horizontal document overflow.

Capture light and dark screenshots as review artifacts. Do not commit pixel snapshots unless they prove stable across the supported browser used in CI.

### 7.3 Physical-device acceptance

On iPhone, verify with the user's screenshots as the comparison target:

1. Docked in light mode: compare toolbar height, side inset, capsule radius, 8 px separation, and circular tactile bubble against the native Obsidian toolbar.
2. Docked in dark mode: verify that the bubble boundary remains visible rather than blending into the keyboard band.
3. Detach while the keyboard remains open: type until the final line reaches the keyboard boundary and confirm there is no dead row.
4. Hold floating, reveal target, cancel, and repeat step 3.
5. Redock, rotate, close/reopen the keyboard, and repeat in predictive-text variants.

Repeat the behavioral sequence on Android, accepting platform-native differences in shadow and safe-area geometry.

## 8. Implementation sequence

1. Add the rendered mobile fixture and reproduce both failures before changing production behavior.
2. Move reparentable CSS variables onto plugin-owned components and remove borrowed native child classes.
3. Introduce `MobileToolbarHost`, route every host mutation through `reconcile()`, and add transition coverage.
4. Extract pure viewport geometry and retain the existing fixed-coordinate behavior.
5. Verify the fixture in light, dark, portrait, and landscape layouts.
6. Build `main.js`, run the full automated suite, and verify source/bundle identity.
7. Deploy to the live vault, reload the plugin, and complete iPhone acceptance before updating release metadata or publishing.

Each step should leave `npm run check` passing. Do not combine the host refactor with command, settings-schema, gesture-threshold, or release-version changes.

## 9. Completion criteria

The refactor is complete only when all of the following are true:

- Toolbar+ styling is unchanged when the bar moves between overlay and native hosts.
- Docked capsule and tactile bubble match native mobile dimensions and adapt to light/dark themes.
- Floating mode leaves no Toolbar+ or native toolbar rectangle between editor and keyboard.
- All DOM host mutations originate in `MobileToolbarHost`.
- Viewport calculations are pure and independently tested.
- Existing command, gesture, persistence, alias, and accessibility behavior passes unchanged.
- The compiled live bundle exactly matches source.
- Physical iPhone testing confirms both the visual change and removal of the dead row.

## 10. Compatibility and rollback

The refactor keeps configuration version 1 and requires no data migration. `.mobile-toolbar` remains the sole private Obsidian DOM dependency. If Obsidian removes that host, Toolbar+ falls back to its overlay root and leaves native DOM untouched.

Keep the work in reviewable commits: fixture, CSS ownership, host controller, and viewport extraction. If physical testing finds a regression, the host-controller commit can be reverted without altering saved user configuration.
