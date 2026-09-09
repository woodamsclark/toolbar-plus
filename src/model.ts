export const directions = ["nw", "n", "ne", "w", "e", "sw", "s", "se"] as const;
export type Direction = (typeof directions)[number];
export const arrows: Record<Direction, string> = {
  nw: "↖",
  n: "↑",
  ne: "↗",
  w: "←",
  e: "→",
  sw: "↙",
  s: "↓",
  se: "↘",
};
export interface Binding {
  id: string;
  icon: string;
}
export interface Config {
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
const binding = (id: string, icon: string): Binding => ({ id, icon });
export function defaults(): Config {
  const gestures = {
    nw: binding("editor:undo", "undo-2"),
    n: binding("editor:set-heading", "heading"),
    ne: binding("editor:redo", "redo-2"),
    w: binding("editor:unindent-list", "outdent"),
    e: binding("editor:indent-list", "indent"),
    sw: binding("editor:insert-link", "link"),
    s: binding("editor:toggle-checklist-status", "list-todo"),
    se: binding("command-palette:open", "terminal"),
  };
  return {
    version: 1,
    mode: "docked",
    position: { x: 0.85, y: 0.65 },
    docked: [
      gestures.nw,
      gestures.ne,
      gestures.sw,
      gestures.n,
      gestures.s,
      gestures.e,
      gestures.w,
      gestures.se,
    ].map((b) => ({ ...b })),
    gestures,
    haptics: true,
    showGrid: true,
    desktop: false,
    holdMs: 450,
    threshold: 28,
  };
}
export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(n, Math.max(min, max)));
}
export function directionAt(
  dx: number,
  dy: number,
  threshold: number,
): Direction | null {
  if (Math.hypot(dx, dy) < threshold) return null;
  return (["e", "se", "s", "sw", "w", "nw", "n", "ne"] as Direction[])[
    (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8
  ];
}
export function normalize(raw: unknown): Config {
  const d = defaults();
  if (!raw || typeof raw !== "object") return d;
  const r = raw as Partial<Config>;
  const valid = (b: unknown): b is Binding =>
    !!b &&
    typeof b === "object" &&
    typeof (b as Binding).id === "string" &&
    typeof (b as Binding).icon === "string";
  if (r.mode === "floating") d.mode = r.mode;
  if (
    r.position &&
    Number.isFinite(r.position.x) &&
    Number.isFinite(r.position.y)
  )
    d.position = { x: clamp(r.position.x, 0, 1), y: clamp(r.position.y, 0, 1) };
  if (Array.isArray(r.docked))
    d.docked = r.docked
      .filter(valid)
      .slice(0, 40)
      .map((b) => ({ ...b }));
  for (const dir of directions)
    if (valid(r.gestures?.[dir])) d.gestures[dir] = { ...r.gestures![dir] };
  for (const key of ["haptics", "showGrid", "desktop"] as const)
    if (typeof r[key] === "boolean") d[key] = r[key];
  if (Number.isFinite(r.holdMs)) d.holdMs = clamp(r.holdMs!, 300, 1200);
  if (Number.isFinite(r.threshold)) d.threshold = clamp(r.threshold!, 16, 80);
  return d;
}
