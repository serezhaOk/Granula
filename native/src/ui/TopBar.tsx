// Top bar: sample chip (opens library) + play/pause + record — index.html
// #topbar (102-120, 260-266). Hidden while a knob is expanded.

import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { controller } from "../core/controller";
import { useAppState } from "./useAppState";

export function TopBar({
  hidden,
  onOpenLibrary,
  onRecord,
}: {
  hidden: boolean;
  onOpenLibrary: () => void;
  onRecord: () => void;
}) {
  const { playing, currentName } = useAppState();
  const insets = useSafeAreaInsets();

  if (hidden) return null;

  return (
    <View style={[styles.bar, { top: insets.top + 12 }]} pointerEvents="box-none">
      <Pressable style={styles.chip} onPress={onOpenLibrary}>
        <Text numberOfLines={1} style={styles.chipText}>
          {currentName}
        </Text>
      </Pressable>
      <View style={styles.right}>
        <Pressable style={styles.round} onPress={() => controller.togglePlay()}>
          <Text style={styles.roundText}>{playing ? "❚❚" : "▶"}</Text>
        </Pressable>
        <Pressable style={styles.round} onPress={onRecord}>
          <View style={styles.recDot} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  chip: {
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 100,
    maxWidth: "55%",
  },
  chipText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "DMMono_500Medium",
  },
  right: { flexDirection: "row", gap: 10 },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  roundText: { color: "#fff", fontSize: 14, fontFamily: "DMMono_400Regular" },
  recDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#ff3b30" },
});
