import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clampHandlePoint,
  normalizedFromPoint,
  placementSize,
  pointFromNormalized,
  toolbarPositions,
  viewportBounds,
} from "../src/viewport-layout.ts";

test("visual viewport bounds stay local to fixed-position coordinates", () => {
  const bounds = viewportBounds({ width: 390, height: 460 }, 390, 700);
  assert.deepEqual(bounds, { left: 0, top: 0, width: 390, height: 460 });
  assert.deepEqual(viewportBounds(null, 320, 568), {
    left: 0,
    top: 0,
    width: 320,
    height: 568,
  });
});

test("normalized placement survives a keyboard-reduced viewport", () => {
  const bounds = { left: 0, top: 0, width: 390, height: 400 };
  const placement = placementSize(bounds, 390, 700, 390, 700);
  assert.deepEqual(placement, { width: 390, height: 700 });
  const point = pointFromNormalized({ x: 0.5, y: 1 }, placement);
  assert.deepEqual(normalizedFromPoint(point, placement), { x: 0.5, y: 1 });
  const clamped = clampHandlePoint(point, bounds, {
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  });
  assert.ok(clamped.y < point.y);
  assert.ok(clamped.y + 48 <= bounds.height - 8);
});

test("toolbar and docking target follow current visual viewport height", () => {
  assert.deepEqual(
    toolbarPositions({ left: 0, top: 0, width: 390, height: 500 }, 40),
    { height: 40, top: 460, targetTop: 440 },
  );
  assert.deepEqual(
    toolbarPositions({ left: 0, top: 0, width: 390, height: 30 }, NaN),
    { height: 30, top: 0, targetTop: 0 },
  );
});
