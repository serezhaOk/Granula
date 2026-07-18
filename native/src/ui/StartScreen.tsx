// Start overlay — index.html #start (162-171, 271-275). The perimeter glow, the
// lowercase "granula" wordmark and "tap to start". Tapping boots the engine
// (AudioContext must start from a user gesture) and dismisses the overlay.

import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { StartGlow } from "../visuals/StartGlow";

export function StartScreen({ onStart }: { onStart: () => Promise<void> | void }) {
  const [busy, setBusy] = useState(false);
  const press = async () => {
    if (busy) return;
    setBusy(true);
    await onStart();
  };
  return (
    <Pressable style={styles.overlay} onPress={press}>
      <StartGlow />
      <Text style={styles.title}>granula</Text>
      <View style={styles.bottom}>
        <Text style={styles.hint}>tap to start</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
  },
  title: {
    fontSize: 42,
    fontWeight: "300",
    letterSpacing: 1,
    color: "#f2f2f2",
    fontFamily: "DMMono_300Light",
  },
  bottom: { position: "absolute", bottom: "16%" },
  hint: { color: "rgba(255,255,255,0.55)", fontSize: 14, letterSpacing: 0.5, fontFamily: "DMMono_400Regular" },
});
