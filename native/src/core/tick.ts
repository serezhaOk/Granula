// Central animation tick — the part of the web build's animate() loop that must
// run regardless of what's on screen: easing the morph point (so the grain
// engine's corner strengths follow the finger) and deriving the smoothed audio
// level/peak from the playback analyser. Visual components run their own draw
// loops and read the shared `audio` values below. Matches index.html 1080-1114.

import { engine } from "../audio/engine";
import { controller } from "./controller";
import { morph } from "./params";

export const audio = {
  level: 0, // smoothed RMS (drives particle flicker)
  peak: 0, // instantaneous peak (drives rec oscilloscope)
  slowLevel: 0, // heavily smoothed (background breathing)
};

const levelArr = new Uint8Array(256);
let raf: ReturnType<typeof requestAnimationFrame> | null = null;

function loop() {
  // ease morph (audio reacts faster than the background)
  const k = morph.touching ? 0.16 : 0.03;
  morph.x += (morph.tx - morph.x) * k;
  morph.y += (morph.ty - morph.y) * k;

  let level = 0;
  let peak = 0;
  const an = engine.getAnalyser();
  if (an) {
    an.getByteTimeDomainData(levelArr);
    let sum = 0;
    for (let i = 0; i < levelArr.length; i++) {
      const v = (levelArr[i] - 128) / 128;
      sum += v * v;
      const abs = v < 0 ? -v : v;
      if (abs > peak) peak = abs;
    }
    level = Math.sqrt(sum / levelArr.length);
  }
  // during recording the peak comes from the mic (metering), like micAnalyser
  if (controller.getSnapshot().recording) peak = controller.recLevel;

  audio.level = level;
  audio.peak = peak;
  audio.slowLevel += (level - audio.slowLevel) * 0.08;

  raf = requestAnimationFrame(loop);
}

export function startTick() {
  if (raf == null) loop();
}
export function stopTick() {
  if (raf != null) cancelAnimationFrame(raf);
  raf = null;
}
