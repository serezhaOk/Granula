// #fx — the Cogmind-style ASCII particle field, ported 1:1 from index.html
// 996-1177. A grid of faint dots; touch points "ignite" clusters of glyph cells
// coloured by the bilinear corner blend; cells decay each frame and flicker
// faster with audio level. Drawn with react-native-skia at points-scale (Skia
// handles device pixel ratio, so the web build's *dpr factors are dropped).

import { useEffect, useMemo, useRef, useState } from "react";
import { useWindowDimensions } from "react-native";
import {
  Canvas,
  Picture,
  Skia,
  createPicture,
  useFont,
  type SkFont,
  type SkPicture,
} from "@shopify/react-native-skia";
import { DMMono_500Medium } from "@expo-google-fonts/dm-mono";

import { audio } from "../core/tick";
import { engine } from "../audio/engine";
import { pointers } from "../core/params";

const CELL = 24;
const FONT_SIZE = Math.round(CELL * 0.74);
const GLYPHS = ".:;+*=!?/\\|<>[]{}()#%&$~^',";
const CORNER_RGB: Record<"tl" | "tr" | "bl" | "br", [number, number, number]> = {
  tl: [90, 200, 255],
  tr: [255, 80, 200],
  bl: [90, 230, 120],
  br: [255, 145, 50],
};

function cornerColor(u: number, v: number): [number, number, number] {
  const w = { tl: (1 - u) * (1 - v), tr: u * (1 - v), bl: (1 - u) * v, br: u * v };
  let r = 0,
    g = 0,
    b = 0;
  (Object.keys(w) as (keyof typeof w)[]).forEach((k) => {
    r += CORNER_RGB[k][0] * w[k];
    g += CORNER_RGB[k][1] * w[k];
    b += CORNER_RGB[k][2] * w[k];
  });
  return [r, g, b];
}

interface Grid {
  cols: number;
  rows: number;
  int: Float32Array;
  glyph: Uint8Array;
  colR: Uint8Array;
  colG: Uint8Array;
  colB: Uint8Array;
  dotsPic: SkPicture;
}

function makeGrid(w: number, h: number): Grid {
  const cols = Math.ceil(w / CELL);
  const rows = Math.ceil(h / CELL);
  const n = cols * rows;
  const s = Math.max(1, Math.round(CELL * 0.08));
  const dotsPic = createPicture((canvas) => {
    const paint = Skia.Paint();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        paint.setColor(Skia.Color("rgb(154,160,180)"));
        paint.setAlphaf(0.07 + Math.random() * 0.1);
        canvas.drawRect(
          Skia.XYWHRect(c * CELL + (CELL - s) / 2, r * CELL + (CELL - s) / 2, s, s),
          paint
        );
      }
    }
  });
  return {
    cols,
    rows,
    int: new Float32Array(n),
    glyph: new Uint8Array(n),
    colR: new Uint8Array(n),
    colG: new Uint8Array(n),
    colB: new Uint8Array(n),
    dotsPic,
  };
}

function ignite(g: Grid, pxCss: number, pyCss: number, strength: number, u: number, v: number) {
  const cx = (pxCss / CELL) | 0;
  const cy = (pyCss / CELL) | 0;
  const base = cornerColor(Math.max(0, Math.min(1, u)), Math.max(0, Math.min(1, v)));
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const x = cx + dx,
        y = cy + dy;
      if (x < 0 || y < 0 || x >= g.cols || y >= g.rows) continue;
      const d2 = dx * dx + dy * dy;
      if (d2 > 11) continue;
      if (d2 > 6 && Math.random() < 0.45) continue; // ragged outer edge
      const f = strength * Math.max(0, 1 - Math.sqrt(d2) / 3.2);
      const i = y * g.cols + x;
      if (f > g.int[i]) {
        g.int[i] = Math.min(1, f);
        const j = 0.8 + Math.random() * 0.45; // neighbour brightness spread
        g.colR[i] = Math.min(255, base[0] * j) | 0;
        g.colG[i] = Math.min(255, base[1] * j) | 0;
        g.colB[i] = Math.min(255, base[2] * j) | 0;
        g.glyph[i] = (Math.random() * GLYPHS.length) | 0;
      }
    }
  }
}

function drawFrame(g: Grid, font: SkFont, adv: number): SkPicture {
  // ignite cells under active fingers (only while a sample is loaded)
  const level = audio.level;
  if (pointers.size && engine.buffer) {
    pointers.forEach((p) => ignite(g, p.px, p.py, 0.85 + level * 0.4, p.x, p.y));
  }
  return createPicture((canvas) => {
    canvas.drawPicture(g.dotsPic);
    const paint = Skia.Paint();
    const flick = 0.2 + level * 0.45; // audio speeds up glyph churn
    for (let i = 0; i < g.int.length; i++) {
      const val = g.int[i];
      if (val < 0.02) {
        if (val !== 0) g.int[i] = 0;
        continue;
      }
      g.int[i] = val * 0.75; // decay tail
      const x = (i % g.cols) * CELL;
      const y = ((i / g.cols) | 0) * CELL;
      if (Math.random() < flick) g.glyph[i] = (Math.random() * GLYPHS.length) | 0;
      const gl = GLYPHS[g.glyph[i]];
      const glyphX = x + CELL / 2 - adv / 2;
      const glyphY = y + CELL / 2 + FONT_SIZE * 0.35;
      if (val > 0.78) {
        // core — dense fill, sometimes a dark glyph on top (as in the reference)
        paint.setColor(Skia.Color(`rgb(${g.colR[i]},${g.colG[i]},${g.colB[i]})`));
        paint.setAlphaf(val);
        canvas.drawRect(
          Skia.XYWHRect(x + CELL * 0.06, y + CELL * 0.06, CELL * 0.88, CELL * 0.88),
          paint
        );
        if (g.glyph[i] & 1) {
          paint.setColor(Skia.Color("black"));
          paint.setAlphaf(0.55);
          canvas.drawGlyphs(
            [font.getGlyphIDs(gl)[0]],
            [{ x: glyphX, y: glyphY }],
            0,
            0,
            font,
            paint
          );
        }
      } else {
        // halo — translucent fill over the whole cluster + glyph
        paint.setColor(Skia.Color(`rgb(${g.colR[i]},${g.colG[i]},${g.colB[i]})`));
        paint.setAlphaf(0.12 + val * 0.5);
        canvas.drawRect(
          Skia.XYWHRect(x + CELL * 0.06, y + CELL * 0.06, CELL * 0.88, CELL * 0.88),
          paint
        );
        paint.setAlphaf(Math.min(1, val * 1.35));
        canvas.drawGlyphs(
          [font.getGlyphIDs(gl)[0]],
          [{ x: glyphX, y: glyphY }],
          0,
          0,
          font,
          paint
        );
      }
    }
  });
}

export function Particles() {
  const { width, height } = useWindowDimensions();
  const font = useFont(DMMono_500Medium, FONT_SIZE);
  const grid = useMemo(() => (font ? makeGrid(width, height) : null), [width, height, font]);
  const adv = useMemo(() => (font ? font.getGlyphWidths(font.getGlyphIDs("0"))[0] : FONT_SIZE * 0.6), [font]);
  const [pic, setPic] = useState<SkPicture | null>(null);
  const rafRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  useEffect(() => {
    if (!grid || !font) return;
    const loop = () => {
      setPic(drawFrame(grid, font, adv));
      rafRef.current = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [grid, font, adv]);

  return (
    <Canvas style={{ position: "absolute", width, height }} pointerEvents="none">
      {pic && <Picture picture={pic} />}
    </Canvas>
  );
}
