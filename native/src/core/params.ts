// Shared, mutable synth parameters — the direct analogue of the web version's
// module-level globals (KNOBS, morph). Kept outside React so the audio scheduler
// and the Skia render loop read/write them at their own rate without triggering
// re-renders. React components mutate `.value` / `morph.tx/ty` and subscribe only
// for chrome that needs to repaint (the sample chip, knob arcs).

export type KnobKey = "G" | "P" | "D" | "S";

export interface KnobDef {
  label: string;
  min: number;
  max: number;
  value: number;
  fmt: (v: number) => string;
}

export const MAX_SECONDS = 30;
export const MASTER_VOL = 0.85;

export const KNOBS: Record<KnobKey, KnobDef> = {
  G: { label: "Grain size", min: 15, max: 400, value: 90, fmt: (v) => Math.round(v) + " ms" },
  P: { label: "Position", min: 0, max: 1, value: 0.3, fmt: (v) => Math.round(v * 100) + " %" },
  D: { label: "Density", min: 2, max: 60, value: 18, fmt: (v) => Math.round(v) + " /s" },
  S: { label: "Spread", min: 0, max: 1, value: 0.45, fmt: (v) => Math.round(v * 100) + " %" },
};

export const KNOB_ORDER: KnobKey[] = ["G", "P", "D", "S"];

// XY morph point (0..1). tx/ty = touch target, x/y = eased actual value.
export const morph = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, touching: false };

// Live touch points on the morph pad. Keyed by pointer id. x/y are normalized
// 0..1 (for corner-colour blend); px/py are screen points (for particle ignite).
// The MorphPad gesture writes here; the particle visual reads it every frame.
export interface Pointer {
  x: number;
  y: number;
  px: number;
  py: number;
}
export const pointers = new Map<number, Pointer>();

export function morphFromPointers() {
  if (!pointers.size) return;
  let x = 0,
    y = 0;
  pointers.forEach((p) => {
    x += p.x;
    y += p.y;
  });
  morph.tx = x / pointers.size;
  morph.ty = y / pointers.size;
}

// corner strengths from morph point: TL Halo, TR Pulse, BL Tide, BR Chaos
export interface Corners {
  tl: number;
  tr: number;
  bl: number;
  br: number;
}

export function cornerStrengths(): Corners {
  const x = morph.x,
    y = morph.y;
  const w: Corners = {
    tl: (1 - x) * (1 - y),
    tr: x * (1 - y),
    bl: (1 - x) * y,
    br: x * y,
  };
  return {
    tl: Math.max(0, (w.tl - 0.25) / 0.75),
    tr: Math.max(0, (w.tr - 0.25) / 0.75),
    bl: Math.max(0, (w.bl - 0.25) / 0.75),
    br: Math.max(0, (w.br - 0.25) / 0.75),
  };
}

// Precomputed Hann window (grain amplitude envelope), identical to the web build.
export const HANN = (() => {
  const N = 256;
  const a = new Float32Array(N);
  for (let i = 0; i < N; i++) a[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
  return a;
})();
