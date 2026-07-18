// #startFx — the start-screen "siri" perimeter glow, ported 1:1 from index.html
// 1267-1332. Dots within DEPTH cells of any edge pulse with an equalizer built
// from three unsynced waves running around the border; cold colours drift along
// the perimeter.

import { useEffect, useMemo, useRef, useState } from "react";
import { useWindowDimensions } from "react-native";
import {
  Canvas,
  Picture,
  Skia,
  createPicture,
  type SkPicture,
} from "@shopify/react-native-skia";

const P = 14;
const DOT = 3;
const DEPTH = 8;
const TAU = Math.PI * 2;
const START_COLORS: [number, number, number][] = [
  [90, 200, 255], // blue (Halo)
  [80, 220, 230], // cyan
  [150, 90, 255], // violet
  [255, 80, 200], // magenta (Pulse)
];

interface Cell {
  cx: number;
  cy: number;
  d: number;
  u: number;
  jit: number;
}

function makeCells(w: number, h: number): Cell[] {
  const cols = Math.ceil(w / P);
  const rows = Math.ceil(h / P);
  const cells: Cell[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const d = Math.min(c, r, cols - 1 - c, rows - 1 - r);
      if (d >= DEPTH) continue;
      const ang = Math.atan2(r / (rows - 1) - 0.5, c / (cols - 1) - 0.5);
      cells.push({
        cx: c * P + P / 2,
        cy: r * P + P / 2,
        d,
        u: ang / TAU + 0.5,
        jit: Math.random() * TAU,
      });
    }
  }
  return cells;
}

function drawGlow(cells: Cell[], t0: number): SkPicture {
  const t = (Date.now() - t0) / 1000;
  return createPicture((canvas) => {
    const paint = Skia.Paint();
    for (const cell of cells) {
      const u = cell.u;
      const wave =
        0.45 * Math.sin(u * TAU * 3 + t * 3.15) +
        0.35 * Math.sin(u * TAU * 7 - t * 4.8) +
        0.2 * Math.sin(u * TAU * 13 + t * 6.9);
      const hDepth = DEPTH * (0.12 + 0.5 * (0.5 + 0.5 * wave));
      const inten = Math.max(0, 1 - cell.d / hDepth);
      if (inten <= 0.01) continue;
      const pulse = Math.pow(inten, 1.7) * (0.72 + 0.28 * Math.sin(t * 5.1 + cell.jit));
      const seg = ((((u - 0.125 + t * 0.09) % 1) + 1) % 1) * 4;
      const i0 = seg | 0;
      const f = seg - i0;
      const A = START_COLORS[i0];
      const B = START_COLORS[(i0 + 1) % 4];
      const s = DOT * (1 + 1.3 * pulse);
      paint.setColor(
        Skia.Color(
          `rgb(${(A[0] + (B[0] - A[0]) * f) | 0},${(A[1] + (B[1] - A[1]) * f) | 0},${
            (A[2] + (B[2] - A[2]) * f) | 0
          })`
        )
      );
      paint.setAlphaf(Math.min(1, pulse * 1.15));
      canvas.drawRect(Skia.XYWHRect(cell.cx - s / 2, cell.cy - s / 2, s, s), paint);
    }
  });
}

export function StartGlow() {
  const { width, height } = useWindowDimensions();
  const cells = useMemo(() => makeCells(width, height), [width, height]);
  const [pic, setPic] = useState<SkPicture | null>(null);
  const rafRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  useEffect(() => {
    const t0 = Date.now();
    const loop = () => {
      setPic(drawGlow(cells, t0));
      rafRef.current = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [cells]);

  return (
    <Canvas style={{ position: "absolute", width, height }} pointerEvents="none">
      {pic && <Picture picture={pic} />}
    </Canvas>
  );
}
