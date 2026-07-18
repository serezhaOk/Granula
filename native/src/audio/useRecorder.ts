// Microphone recording via expo-audio. This is the native adaptation of the
// web build's MediaRecorder path (index.html 678-865): request permission,
// switch the audio session to play-and-record, mute the grain cloud, record to
// a file with metering, cap at 30s, then hand the file to the controller which
// decodes + saves it. The recording oscilloscope reads controller.recLevel,
// which we feed from the recorder's metering (dBFS → linear).

import { useCallback, useEffect, useRef } from "react";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";

import { controller } from "../core/controller";
import { randomRecName } from "../core/names";
import { MAX_SECONDS } from "../core/params";
import { setSession } from "./session";

const OPTIONS = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true };

export function useRecorder() {
  const recorder = useAudioRecorder(OPTIONS);
  const status = useAudioRecorderState(recorder, 50);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(0);
  const busy = useRef(false);

  // feed the oscilloscope: dBFS metering -> linear peak (as the web build fed
  // AnalyserNode peakAmp). RecWave re-derives dB from this.
  useEffect(() => {
    if (!status.isRecording) return;
    const db = typeof status.metering === "number" ? status.metering : -60;
    controller.recLevel = Math.min(1, Math.pow(10, db / 20));
  }, [status.metering, status.isRecording]);

  const clearTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const start = useCallback(async () => {
    if (busy.current || status.isRecording) return;
    busy.current = true;
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        busy.current = false;
        return;
      }
      // mute everything before the mic goes live, else the speaker bleeds in
      controller.beginRecordingUI();
      setSession("play-and-record");
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });

      await recorder.prepareToRecordAsync(OPTIONS);
      recorder.record();
      startedAt.current = Date.now();

      clearTimer();
      timerRef.current = setInterval(() => {
        const s = Math.floor((Date.now() - startedAt.current) / 1000);
        controller.setRecElapsed(s);
        if (s >= MAX_SECONDS) void stop();
      }, 100);
    } catch {
      controller.cancelRecordingUI();
      busy.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder, status.isRecording]);

  const finalize = useCallback(
    async (cancelled: boolean) => {
      clearTimer();
      let uri: string | null = null;
      try {
        await recorder.stop();
        uri = recorder.uri ?? null;
      } catch {
        uri = null;
      }
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (cancelled || !uri) {
        controller.cancelRecordingUI();
      } else {
        const name = await randomRecName();
        await controller.finishRecording(uri, name);
      }
      busy.current = false;
    },
    [recorder]
  );

  const stop = useCallback(() => finalize(false), [finalize]);
  const cancel = useCallback(() => finalize(true), [finalize]);

  useEffect(() => () => clearTimer(), []);

  return { start, stop, cancel };
}
