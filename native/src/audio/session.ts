// Audio session category — the native analogue of the web build's
// `navigator.audioSession.type`. On iOS "playback" plays even with the silent
// switch on; "play-and-record" is used while the microphone is live so the
// speaker does not fight the mic. react-native-audio-api exposes AudioManager
// for this; the exact surface has shifted across versions, so we probe
// defensively and degrade to a no-op rather than crashing.

import * as AudioAPI from "react-native-audio-api";

type SessionType = "playback" | "play-and-record";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AudioManager: any = (AudioAPI as any).AudioManager;

export function setSession(type: SessionType) {
  if (!AudioManager) return;
  try {
    const iosCategory = type === "play-and-record" ? "playAndRecord" : "playback";
    if (typeof AudioManager.setAudioSessionOptions === "function") {
      AudioManager.setAudioSessionOptions({
        iosCategory,
        iosMode: "default",
        iosOptions: ["defaultToSpeaker", "allowBluetooth"],
      });
    } else if (typeof AudioManager.setAudioSessionCategory === "function") {
      AudioManager.setAudioSessionCategory(iosCategory);
    }
    if (typeof AudioManager.setAudioSessionActivity === "function") {
      AudioManager.setAudioSessionActivity(true);
    }
  } catch {
    // no-op: never let session setup break audio start
  }
}
