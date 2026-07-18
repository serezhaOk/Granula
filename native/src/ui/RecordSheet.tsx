// Recording sheet — index.html #recOverlay (173-210, 277-285). Slides up while
// recording: a live timer, the dot-matrix oscilloscope (RecWave) filling the
// sheet, a cancel ✕ and a Stop button. 30s cap is enforced by the recorder hook.

import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RecWave } from "../visuals/RecWave";
import { useAppState } from "./useAppState";

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
}

export function RecordSheet({ onStop, onCancel }: { onStop: () => void; onCancel: () => void }) {
  const { recording, recElapsed } = useAppState();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={recording} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.sheet}>
        <RecWave width={width} height={height} midFraction={0.52} />

        <View style={[styles.head, { top: insets.top + 58 }]}>
          <View style={styles.dot} />
          <Text style={styles.headText}>RECORDING...</Text>
        </View>
        <Pressable style={[styles.close, { top: insets.top + 46 }]} onPress={onCancel}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>

        <Text style={styles.timer}>{fmt(recElapsed)}</Text>

        <Pressable style={[styles.stop, { bottom: insets.bottom + 56 }]} onPress={onStop}>
          <Text style={styles.stopText}>STOP</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: "#050505",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    alignItems: "center",
  },
  head: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#ff3b30" },
  headText: {
    fontSize: 11,
    letterSpacing: 3,
    color: "#c9c9c9",
    fontFamily: "DMMono_500Medium",
  },
  close: { position: "absolute", right: 18, width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  closeText: { color: "#8a8a8a", fontSize: 22 },
  timer: {
    marginTop: "30%",
    fontSize: 52,
    color: "#fff",
    letterSpacing: 6,
    fontVariant: ["tabular-nums"],
    fontFamily: "DMMono_400Regular",
  },
  stop: {
    position: "absolute",
    width: 132,
    height: 42,
    borderRadius: 999,
    backgroundColor: "#3a0d0d",
    alignItems: "center",
    justifyContent: "center",
  },
  stopText: { color: "#ff9d9d", fontSize: 12, letterSpacing: 3, fontFamily: "DMMono_500Medium" },
});
