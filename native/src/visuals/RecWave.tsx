// #recWave — the dot-matrix recording oscilloscope, ported 1:1 from index.html
// 683-759. The wave scrolls left; each column's height is a dB (VU-meter) scale
// of the mic level, with a deterministic blue "sparkle" flicker. Level comes
// from audio.peak, which the recorder feeds from metering.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Canvas,
  Picture,
  Skia,
  createPicture,
  type SkPicture,
} from "@shopify/react-native-skia";

import { audio } from "../core/tick";

const RW_PITCH = 14;
const RW_DOT = 3;
const RW_STEP_MS = 54;
const RW_BAND_HALF = 9;

interface WaveState {
  cols: number;
  rows: number;
  mid: number;
  hist: Float32Array;
  lastPush: number;
  basePic: SkPicture;
}

function makeWave(w: number, h: number, midFraction: number): WaveState {
  const cols = Math.floor(w / RW_PITCH);
  let rows = Math.floor(h / RW_PITCH) | 1;
  let mid = Math.round(rows * midFraction);
  mid = Math.max(RW_BAND_HALF + 2, Math.min(rows - RW_BAND_HALF - 3, mid));
  // baked background: faint dot at every cell, brighter along the axis row
  const basePic = createPicture((canvas) => {
    const paint = Skia.Paint();
    const off = (RW_PITCH - RW_DOT) / 2;
    for (let row = 0; row < rows; row++) {
      const alpha = row === mid ? 0.3 : 0.09;
      for (let c = 0; c < cols; c++) {
        paint.setColor(Skia.Color("white"));
        paint.setAlphaf(alpha);
        canvas.drawRect(
          Skia.XYWHRect(c * RW_PITCH + off, row * RW_PITCH + off, RW_DOT, RW_DOT),
          paint
        );
      }
    }
  });
  return { cols, rows, mid, hist: new Float32Array(cols), lastPush: 0, basePic };
}

function drawWave(s: WaveState): SkPicture {
  const now = Date.now();
  const level = audio.peak;
  if (now - s.lastPush > RW_STEP_MS) {
    s.hist.copyWithin(0, 1);
    // dB scale like a VU meter: −48 dB silence … −6 dB loud
    const db = 20 * Math.log10(Math.max(level, 0.0001));
    s.hist[s.cols - 1] = Math.min(1, Math.max(0, (db + 48) / 42));
    s.lastPush = now;
  }
  const off = (RW_PITCH - RW_DOT) / 2;
  const tb = (now / 130) | 0; // time-bucket: a flash lives ~130ms
  return createPicture((canvas) => {
    canvas.drawPicture(s.basePic);
    const paint = Skia.Paint();
    for (let c = 0; c < s.cols; c++) {
      const amp = s.hist[c];
      if (amp <= 0.02) continue;
      const lit = Math.max(1, Math.round(Math.pow(amp, 1.4) * RW_BAND_HALF));
      const x = c * RW_PITCH + off;
      const dMax = lit >= 2 ? lit + 1 : lit - 1; // single quiet dot has no halo
      for (let d = 0; d <= dMax; d++) {
        let a: number;
        let color = "white";
        if (d < lit) {
          a = 0.95;
          if ((((c * 73856093) ^ (d * 19349663) ^ (tb * 83492791)) >>> 0) % 14 === 0) {
            color = "rgb(79,195,255)";
            a = 1;
          }
        } else if (d === lit) a = 0.5;
        else a = 0.2;
        paint.setColor(Skia.Color(color));
        paint.setAlphaf(a);
        canvas.drawRect(
          Skia.XYWHRect(x, (s.mid - d) * RW_PITCH + off, RW_DOT, RW_DOT),
          paint
        );
        if (d) {
          canvas.drawRect(
            Skia.XYWHRect(x, (s.mid + d) * RW_PITCH + off, RW_DOT, RW_DOT),
            paint
          );
        }
      }
    }
  });
}

export function RecWave({
  width,
  height,
  midFraction = 0.5,
}: {
  width: number;
  height: number;
  midFraction?: number;
}) {
  const state = useMemo(
    () => (width > 0 && height > 0 ? makeWave(width, height, midFraction) : null),
    [width, height, midFraction]
  );
  const [pic, setPic] = useState<SkPicture | null>(null);
  const rafRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  useEffect(() => {
    if (!state) return;
    const loop = () => {
      setPic(drawWave(state));
      rafRef.current = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [state]);

  return (
    <Canvas style={{ position: "absolute", width, height }} pointerEvents="none">
      {pic && <Picture picture={pic} />}
    </Canvas>
  );
}
