import { test } from "node:test";
import assert from "node:assert/strict";
import { directionAt, normalize, defaults, clamp } from "../src/model.ts";
test("eight sectors and center cancellation", () => {
  const vectors = [
    [0, -40, "n"],
    [40, -40, "ne"],
    [40, 0, "e"],
    [40, 40, "se"],
    [0, 40, "s"],
    [-40, 40, "sw"],
    [-40, 0, "w"],
    [-40, -40, "nw"],
  ] as const;
  for (const [x, y, d] of vectors) assert.equal(directionAt(x, y, 28), d);
  assert.equal(directionAt(10, 10, 28), null);
  assert.equal(directionAt(0, 0, 28), null);
});
test("floating gesture defaults match the shipped toolbar+ layout", () => {
  const { gestures } = defaults();
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(gestures).map(([direction, binding]) => [
        direction,
        binding.id,
      ]),
    ),
    {
      nw: "editor:undo",
      n: "command-palette:open",
      ne: "editor:redo",
      w: "workspace:goto-last-tab",
      e: "workspace:next-tab",
      sw: "editor:copy",
      s: "editor:toggle-keyboard",
      se: "editor:paste",
    },
  );
});
test("malformed settings recover while intentional empty bindings persist", () => {
  assert.deepEqual(normalize(null), defaults());
  const config = normalize({
    mode: "bad",
    position: { x: 100, y: -10 },
    docked: [null, { id: "ok", icon: "link" }],
    gestures: { n: { id: "", icon: "minus" } },
    holdMs: 10,
    threshold: 1000,
    haptics: "false",
  });
  assert.equal(config.mode, "docked");
  assert.deepEqual(config.position, { x: 1, y: 0 });
  assert.equal(config.docked.length, 1);
  assert.equal(config.gestures.n.id, "");
  assert.equal(config.holdMs, 300);
  assert.equal(config.threshold, 80);
  assert.equal(config.haptics, true);
  assert.deepEqual(normalize({ docked: [] }).docked, []);
});
test("invalid viewport sizes never produce an unreachable negative coordinate", () => {
  assert.equal(clamp(20, 8, -40), 8);
});
