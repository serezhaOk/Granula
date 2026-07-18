// ============================================================================
// GRANULA grain engine — ported 1:1 from the web build (index.html lines
// 333-560). The DSP maths and scheduling are unchanged; only the Web Audio
// entry points are swapped for `react-native-audio-api`, whose graph mirrors
// the Web Audio API. The JS look-ahead scheduler runs on setInterval exactly
// as in the browser, driven off ctx.currentTime.
// ============================================================================

import {
  AudioBuffer,
  AudioContext,
  AnalyserNode,
  GainNode,
} from "react-native-audio-api";

import {
  cornerStrengths,
  HANN,
  KNOBS,
  MASTER_VOL,
  MAX_SECONDS,
  morph,
} from "../core/params";

// iOS/Android audio session handling lives in a tiny wrapper so the engine
// stays focused on DSP; see ./session.ts.
import { setSession } from "./session";

const LOOKAHEAD = 0.12;
const TICK = 25;
const GATE_STEP = 60 / 126 / 4; // 16th notes at 126 BPM

export class GranulaEngine {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private reverbIn: GainNode | null = null;
  private dryGate: GainNode | null = null;

  buffer: AudioBuffer | null = null;
  revBuf: AudioBuffer | null = null;

  playing = true;
  private schedulerId: ReturnType<typeof setInterval> | null = null;
  private gateId: ReturnType<typeof setInterval> | null = null;
  private nextGrainTime = 0;
  private nextGateTime = 0;

  // -------------------------------------------------------- setup / teardown
  init() {
    if (this.ctx) return;
    setSession("playback");
    const ctx = new AudioContext();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = MASTER_VOL;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    master.connect(analyser);
    analyser.connect(ctx.destination);
    this.master = master;
    this.analyser = analyser;

    // trance-gate: chops only dry grains; the reverb cloud stays continuous
    const dryGate = ctx.createGain();
    dryGate.gain.value = 1;
    dryGate.connect(master);
    this.dryGate = dryGate;

    // shimmer reverb: bus -> convolver(6s) -> gain -> master
    const reverbIn = ctx.createGain();
    const conv = ctx.createConvolver();
    conv.buffer = this.makeIR(6, 2.8);
    const wet = ctx.createGain();
    wet.gain.value = 0.9;
    reverbIn.connect(conv);
    conv.connect(wet);
    wet.connect(master);
    this.reverbIn = reverbIn;

    // trance-gate clock
    this.gateId = setInterval(() => this.gateTick(), 25);
  }

  resume() {
    this.ctx?.resume().catch(() => {});
  }

  getAnalyser() {
    return this.analyser;
  }

  // -------------------------------------------------------- buffer factories
  private newBuffer(channels: number, length: number, sampleRate: number): AudioBuffer {
    return this.ctx!.createBuffer(channels, length, sampleRate);
  }

  makeIR(seconds: number, decay: number): AudioBuffer {
    const sr = this.ctx!.sampleRate;
    const len = Math.floor(seconds * sr);
    const ir = this.newBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = new Float32Array(len);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
      ir.copyToChannel(d, ch);
    }
    return ir;
  }

  genPad(): AudioBuffer {
    const sr = this.ctx!.sampleRate;
    const secs = 5;
    const len = secs * sr;
    const buf = this.newBuffer(2, len, sr);
    const L = new Float32Array(len);
    const R = new Float32Array(len);
    const roots = [110, 164.81, 220, 277.18];
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      let s = 0;
      for (let k = 0; k < roots.length; k++) {
        const det = 1 + 0.0015 * Math.sin(2 * Math.PI * (0.1 + k * 0.07) * t);
        s += Math.sin(2 * Math.PI * roots[k] * det * t) / roots.length;
        s += (0.25 * Math.sin(2 * Math.PI * roots[k] * 2 * t)) / roots.length;
      }
      const amp = 0.55 * (0.7 + 0.3 * Math.sin(2 * Math.PI * 0.13 * t));
      L[i] = s * amp;
      R[i] = s * amp;
    }
    buf.copyToChannel(L, 0);
    buf.copyToChannel(R, 1);
    return buf;
  }

  async decode(arrayBuf: ArrayBuffer): Promise<AudioBuffer> {
    return this.ctx!.decodeAudioData(arrayBuf);
  }

  trimToMax(buf: AudioBuffer): AudioBuffer {
    const maxLen = Math.floor(MAX_SECONDS * buf.sampleRate);
    if (buf.length <= maxLen) return buf;
    const out = this.newBuffer(buf.numberOfChannels, maxLen, buf.sampleRate);
    for (let ch = 0; ch < buf.numberOfChannels; ch++) {
      out.copyToChannel(buf.getChannelData(ch).subarray(0, maxLen), ch);
    }
    return out;
  }

  // reversed copy: grains played backwards sound "dreamlike", pitch unchanged
  reverseBuffer(buf: AudioBuffer): AudioBuffer {
    const out = this.newBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
    for (let ch = 0; ch < buf.numberOfChannels; ch++) {
      const s = buf.getChannelData(ch);
      const d = new Float32Array(buf.length);
      for (let i = 0, n = buf.length; i < n; i++) d[i] = s[n - 1 - i];
      out.copyToChannel(d, ch);
    }
    return out;
  }

  // only boost quiet material (mic recordings); leave loud audio untouched
  normalizeBuffer(buf: AudioBuffer, target = 0.85): AudioBuffer {
    let peak = 0;
    const chans: Float32Array[] = [];
    for (let ch = 0; ch < buf.numberOfChannels; ch++) {
      const d = buf.getChannelData(ch);
      chans.push(d);
      for (let i = 0; i < d.length; i++) {
        const a = Math.abs(d[i]);
        if (a > peak) peak = a;
      }
    }
    if (peak > 0.001 && peak < target) {
      const g = target / peak;
      for (let ch = 0; ch < buf.numberOfChannels; ch++) {
        const d = chans[ch];
        const scaled = new Float32Array(d.length);
        for (let i = 0; i < d.length; i++) scaled[i] = d[i] * g;
        buf.copyToChannel(scaled, ch);
      }
    }
    return buf;
  }

  // Prepare a decoded buffer for playback (trim -> normalize -> build reverse).
  setBuffer(buf: AudioBuffer) {
    this.buffer = this.normalizeBuffer(this.trimToMax(buf));
    this.revBuf = this.reverseBuffer(this.buffer);
    if (this.playing) this.startCloud();
  }

  useBuiltinPad() {
    this.buffer = this.genPad();
    this.revBuf = this.reverseBuffer(this.buffer);
    if (this.playing) this.startCloud();
  }

  // -------------------------------------------------------- grain scheduling
  private effDensity(): number {
    const c = cornerStrengths();
    // Tide: fewer grains but longer — a deep wave, not mush
    return KNOBS.D.value * (1 + 1.2 * c.tr + 0.6 * c.br) * (1 - 0.3 * c.bl);
  }

  private scheduleGrain(when: number) {
    const buffer = this.buffer;
    if (!buffer) return;
    const c = cornerStrengths();
    const S = KNOBS.S.value;

    // Halo (TL): probabilistic octave sparkles, small grains, reverse grains,
    // lots of shimmer — harmony, not a global pitch shift.
    // Tide (BL): long grains, position slowly drifts, chorus detune, sub-octaves.
    // Chaos (BR): random but harmonic intervals, weighted to the tonic.
    let sizeMs = KNOBS.G.value * (1 - 0.4 * c.tl) * (1 + 1.8 * c.bl);
    const HARMONY = [0, 0, 0, 7, -7, 12, -12, 5, -5];
    let pitch = 0;
    if (Math.random() < c.tl * 0.5) pitch += Math.random() < 0.7 ? 12 : 7;
    if (Math.random() < c.bl * 0.25) pitch -= 12;
    if (Math.random() < c.br) pitch += HARMONY[(Math.random() * HARMONY.length) | 0];
    pitch += (Math.random() - 0.5) * 0.6 * c.bl; // chorus warmth, not detune

    const reverse = !!this.revBuf && Math.random() < 0.12 + 0.5 * c.tl + 0.25 * c.bl;
    const sprayMs = 20 + 260 * S + 350 * c.br;
    const panAmt = 0.25 + 0.75 * S;
    const shimmerSend = 0.18 + 0.45 * S + 0.4 * c.tl + 0.3 * c.bl;

    const dur = sizeMs / 1000;
    const jitter = (Math.random() * 2 - 1) * (sprayMs / 1000);
    const tide = Math.sin((Date.now() / 1000) * 0.45) * 0.12 * c.bl;
    let startSec = (KNOBS.P.value + tide) * buffer.duration + jitter;
    startSec = Math.max(0, Math.min(buffer.duration - 0.001, startSec));
    const rate = Math.pow(2, pitch / 12);

    const dens = this.effDensity();
    const peak = Math.min(0.9, 1.4 / Math.sqrt(dens));

    this.spawnVoice(when, startSec, dur, rate, panAmt, peak, shimmerSend, false, reverse);
    // shimmer voice: +1 octave, mostly into reverb
    if (Math.random() < 0.4 + 0.5 * c.tl) {
      this.spawnVoice(
        when + 0.01,
        startSec,
        dur * 1.4,
        rate * 2,
        panAmt,
        peak * (0.25 + 0.3 * S),
        1.0,
        true,
        reverse
      );
    }
  }

  private spawnVoice(
    when: number,
    startSec: number,
    dur: number,
    rate: number,
    panAmt: number,
    peak: number,
    sendAmt: number,
    wetOnly: boolean,
    reverse: boolean
  ) {
    const ctx = this.ctx!;
    let buf = this.buffer!;
    if (reverse && this.revBuf) {
      buf = this.revBuf;
      startSec = Math.max(0, buf.duration - startSec - dur * rate);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;

    const g = ctx.createGain();
    g.gain.value = 0;
    // Hann envelope scaled by peak — the grain window.
    const curve = new Float32Array(HANN.length);
    for (let i = 0; i < HANN.length; i++) curve[i] = HANN[i] * peak;
    g.gain.setValueCurveAtTime(curve, when, dur);

    const pan = ctx.createStereoPanner();
    pan.pan.value = (Math.random() * 2 - 1) * panAmt;
    src.connect(g);
    g.connect(pan);
    if (!wetOnly) pan.connect(this.dryGate!);

    const send = ctx.createGain();
    send.gain.value = sendAmt;
    pan.connect(send);
    send.connect(this.reverbIn!);

    const srcDur = dur * rate;
    src.start(when, startSec, Math.min(srcDur, buf.duration - startSec));
    src.stop(when + dur + 0.02);

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      try {
        src.disconnect();
        g.disconnect();
        pan.disconnect();
        send.disconnect();
      } catch {}
    };
    src.onEnded = cleanup;
    // fallback in case onended is not emitted: reclaim shortly after stop time
    const ms = Math.max(0, (when + dur + 0.05 - this.ctx!.currentTime) * 1000);
    setTimeout(cleanup, ms + 60);
  }

  // trance-gate (Pulse corner): 16ths at 126 BPM, depth = corner strength
  private gateTick() {
    const ctx = this.ctx;
    const dryGate = this.dryGate;
    if (!ctx || !dryGate) return;
    if (this.nextGateTime < ctx.currentTime) this.nextGateTime = ctx.currentTime;
    const depth = cornerStrengths().tr;
    const ahead = ctx.currentTime + 0.18;
    while (this.nextGateTime < ahead) {
      const t = this.nextGateTime;
      if (depth > 0.02) {
        dryGate.gain.setTargetAtTime(1, t, 0.006);
        dryGate.gain.setTargetAtTime(1 - 0.97 * depth, t + GATE_STEP * 0.5, 0.01);
      } else {
        dryGate.gain.setTargetAtTime(1, t, 0.03);
      }
      this.nextGateTime += GATE_STEP;
    }
  }

  private schedulerTick() {
    const ctx = this.ctx!;
    const ahead = ctx.currentTime + LOOKAHEAD;
    while (this.nextGrainTime < ahead) {
      this.scheduleGrain(this.nextGrainTime);
      this.nextGrainTime += (1 / this.effDensity()) * (0.85 + Math.random() * 0.3);
    }
  }

  startCloud() {
    if (this.schedulerId || !this.buffer || !this.ctx) return;
    this.nextGrainTime = this.ctx.currentTime + 0.05;
    this.schedulerId = setInterval(() => this.schedulerTick(), TICK);
  }

  stopCloud() {
    if (this.schedulerId) clearInterval(this.schedulerId);
    this.schedulerId = null;
  }

  setPlaying(p: boolean) {
    this.playing = p;
    if (p) this.startCloud();
    else this.stopCloud();
  }

  // -------------------------------------------------------- master gain ramps
  muteMaster() {
    const ctx = this.ctx,
      master = this.master;
    if (!ctx || !master) return;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
  }

  unmuteMaster() {
    const ctx = this.ctx,
      master = this.master;
    if (!ctx || !master) return;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(MASTER_VOL, ctx.currentTime, 0.1);
  }

  // Restore the loud speaker on iOS after a recording session.
  async kickSession() {
    setSession("playback");
    try {
      await this.ctx?.suspend();
      await this.ctx?.resume();
    } catch {}
  }
}

// single shared instance, mirroring the web build's module globals
export const engine = new GranulaEngine();
