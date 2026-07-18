// App "brain" — the native analogue of the web build's top-level orchestration
// (setCurrent / useBlob / loadFile / useBuiltin / boot). Holds the small slice
// of state React needs to render (via useSyncExternalStore) and coordinates the
// audio engine, the sample library and prefs. Audio timing and visuals do NOT
// go through here — they read the mutable params/analyser directly.

import * as DocumentPicker from "expo-document-picker";

import { engine } from "../audio/engine";
import { decodeUri, persistSampleFile } from "../audio/loader";
import { paletteFor, type Palette } from "./names";
import { KNOBS, KNOB_ORDER } from "./params";
import { dbAdd, dbAll, dbDel, dbGet, dbRename, type SampleRow } from "../storage/library";
import { getPref, removePref, setPref } from "../storage/prefs";

export type PaletteOrRec = Palette | "rec";

export interface AppState {
  started: boolean;
  playing: boolean;
  currentName: string;
  currentId: number | null;
  palette: PaletteOrRec;
  recording: boolean;
  recElapsed: number;
}

type Listener = () => void;

class Controller {
  private state: AppState = {
    started: false,
    playing: true,
    currentName: "—",
    currentId: null,
    palette: "ember",
    recording: false,
    recElapsed: 0,
  };
  private listeners = new Set<Listener>();

  // live mic level (0..~1), read by the recording oscilloscope every frame
  recLevel = 0;
  // the palette to restore after a recording (sample's own palette)
  private samplePalette: Palette = "ember";

  // ------------------------------------------------------------- store glue
  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  getSnapshot = () => this.state;
  private set(patch: Partial<AppState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  // ------------------------------------------------------------- boot
  async boot() {
    engine.init();
    engine.resume();
    await this.restoreKnobs();

    let loaded = false;
    const lastRaw = await getPref("last");
    const last = lastRaw ? parseInt(lastRaw, 10) : NaN;
    if (!isNaN(last)) {
      const rec = await dbGet(last);
      if (rec) loaded = await this.useSample(rec);
    }
    if (!loaded) this.useBuiltin();

    this.set({ started: true });
  }

  // ------------------------------------------------------------- current
  private setCurrent(name: string, id: number | null) {
    this.samplePalette = paletteFor(name);
    this.set({ currentName: name, currentId: id, palette: this.samplePalette });
    if (id != null) setPref("last", String(id));
    else removePref("last");
  }

  private async useUri(uri: string, name: string, id: number | null): Promise<boolean> {
    try {
      const buf = await decodeUri(uri);
      engine.setBuffer(buf);
      this.setCurrent(name, id);
      return true;
    } catch {
      return false;
    }
  }

  useBuiltin() {
    engine.useBuiltinPad();
    this.setCurrent("Pad · встроенный", null);
  }

  async useSample(rec: SampleRow): Promise<boolean> {
    return this.useUri(rec.uri, rec.name, rec.id);
  }

  // ------------------------------------------------------------- file import
  async importFile(): Promise<void> {
    const res = await DocumentPicker.getDocumentAsync({
      type: ["audio/*", "audio/mpeg", "audio/wav", "audio/x-wav"],
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets?.length) return;
    const asset = res.assets[0];
    const uri = await persistSampleFile(asset.uri, asset.name);
    const ok = await this.useUri(uri, asset.name, null);
    if (!ok) return;
    const id = await dbAdd({
      name: asset.name,
      uri,
      duration: engine.buffer?.duration ?? 0,
      ts: Date.now(),
    });
    this.setCurrent(asset.name, id);
  }

  // ------------------------------------------------------------- library ops
  listSamples() {
    return dbAll();
  }
  async deleteSample(id: number) {
    await dbDel(id);
    if (id === this.state.currentId) {
      this.set({ currentId: null });
    }
  }
  async renameSample(id: number, name: string) {
    await dbRename(id, name);
    if (id === this.state.currentId) this.setCurrent(name, id);
  }

  // ------------------------------------------------------------- transport
  togglePlay() {
    const playing = !this.state.playing;
    engine.setPlaying(playing);
    this.set({ playing });
  }

  // ------------------------------------------------------------- recording
  beginRecordingUI() {
    engine.stopCloud();
    engine.muteMaster();
    this.recLevel = 0;
    this.set({ recording: true, recElapsed: 0, palette: "rec" });
  }
  setRecElapsed(sec: number) {
    this.set({ recElapsed: sec });
  }
  // called when the recorder produced a file (or null when cancelled)
  async finishRecording(uri: string | null, name?: string) {
    engine.unmuteMaster();
    await engine.kickSession();
    this.set({ recording: false, palette: this.samplePalette });
    if (!uri) {
      if (this.state.playing && engine.buffer) engine.startCloud();
      return;
    }
    const finalUri = await persistSampleFile(uri, name ?? "recording.m4a");
    const ok = await this.useUri(finalUri, name ?? "recording", null);
    if (!ok) {
      if (this.state.playing && engine.buffer) engine.startCloud();
      return;
    }
    const id = await dbAdd({
      name: name ?? "recording",
      uri: finalUri,
      duration: engine.buffer?.duration ?? 0,
      ts: Date.now(),
    });
    this.setCurrent(name ?? "recording", id);
  }
  cancelRecordingUI() {
    engine.unmuteMaster();
    engine.kickSession();
    this.set({ recording: false, palette: this.samplePalette });
    if (this.state.playing && engine.buffer) engine.startCloud();
  }

  // ------------------------------------------------------------- knob persist
  saveKnobs() {
    const o: Record<string, number> = {};
    for (const k of KNOB_ORDER) o[k] = KNOBS[k].value;
    setPref("knobs", JSON.stringify(o));
  }
  async restoreKnobs() {
    try {
      const raw = await getPref("knobs");
      if (!raw) return;
      const o = JSON.parse(raw);
      for (const k of KNOB_ORDER) if (typeof o[k] === "number") KNOBS[k].value = o[k];
    } catch {}
  }
}

export const controller = new Controller();
