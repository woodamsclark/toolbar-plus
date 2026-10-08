function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export interface ViewportBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Insets {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export const FLOATING_HANDLE_SIZE = 48;
const HORIZONTAL_PLACEMENT_MARGIN = 8;
const VERTICAL_PLACEMENT_MARGIN = 8;
const BOTTOM_HANDLE_CLEARANCE = 8;

export function viewportBounds(
  viewport: Pick<VisualViewport, "width" | "height"> | null | undefined,
  innerWidth: number,
  innerHeight: number,
): ViewportBounds {
  return {
    // Fixed controls use coordinates local to the visual viewport. Its page
    // offset must not be added again when iOS pans around the keyboard.
    left: 0,
    top: 0,
    width: viewport?.width ?? innerWidth,
    height: viewport?.height ?? innerHeight,
  };
}

export function placementSize(
  bounds: ViewportBounds,
  innerWidth: number,
  innerHeight: number,
  documentWidth: number,
  documentHeight: number,
): Size {
  return {
    width: Math.max(bounds.width, innerWidth || 0, documentWidth || 0),
    height: Math.max(bounds.height, innerHeight || 0, documentHeight || 0),
  };
}

export function pointFromNormalized(position: Point, placement: Size): Point {
  return {
    x:
      HORIZONTAL_PLACEMENT_MARGIN +
      position.x * Math.max(0, placement.width - 64),
    y:
      VERTICAL_PLACEMENT_MARGIN +
      position.y * Math.max(0, placement.height - 80),
  };
}

export function normalizedFromPoint(point: Point, placement: Size): Point {
  return {
    x: clamp(
      (point.x - HORIZONTAL_PLACEMENT_MARGIN) /
        Math.max(1, placement.width - 64),
      0,
      1,
    ),
    y: clamp(
      (point.y - VERTICAL_PLACEMENT_MARGIN) /
        Math.max(1, placement.height - 80),
      0,
      1,
    ),
  };
}

export function clampHandlePoint(
  point: Point,
  bounds: ViewportBounds,
  insets: Insets,
): Point {
  return {
    x: clamp(
      point.x,
      bounds.left + Math.max(8, insets.left),
      bounds.left +
        bounds.width -
        FLOATING_HANDLE_SIZE -
        Math.max(8, insets.right),
    ),
    y: clamp(
      point.y,
      bounds.top + Math.max(8, insets.top),
      bounds.top +
        bounds.height -
        FLOATING_HANDLE_SIZE -
        BOTTOM_HANDLE_CLEARANCE -
        Math.max(8, insets.bottom),
    ),
  };
}

export function toolbarPositions(
  bounds: ViewportBounds,
  requestedHeight: number,
) {
  const height = clamp(
    Number.isFinite(requestedHeight) && requestedHeight > 0
      ? requestedHeight
      : 48,
    1,
    bounds.height,
  );
  const top = bounds.height - height;
  return {
    height,
    top,
    targetTop: clamp(top - 4, 0, Math.max(0, bounds.height - 60)),
  };
}
