import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import {
  DMMono_300Light,
  DMMono_400Regular,
  DMMono_500Medium,
} from "@expo-google-fonts/dm-mono";

import { controller } from "./src/core/controller";
import { engine } from "./src/audio/engine";
import { startTick, stopTick } from "./src/core/tick";
import { useRecorder } from "./src/audio/useRecorder";
import type { KnobKey } from "./src/core/params";
import { Particles } from "./src/visuals/Particles";
import { MorphPad } from "./src/ui/MorphPad";
import { Knobs } from "./src/ui/Knobs";
import { TopBar } from "./src/ui/TopBar";
import { Library } from "./src/ui/Library";
import { RecordSheet } from "./src/ui/RecordSheet";
import { StartScreen } from "./src/ui/StartScreen";
import { useAppState } from "./src/ui/useAppState";

function Synth() {
  const { started } = useAppState();
  const [expanded, setExpanded] = useState<KnobKey | null>(null);
  const [libOpen, setLibOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const recorder = useRecorder();

  useEffect(() => {
    if (started) startTick();
    return () => stopTick();
  }, [started]);

  const onStart = useCallback(async () => {
    await controller.boot();
  }, []);

  const collapse = useCallback(() => {
    setExpanded(null);
    // safety: if the OS suspended the context (call, backgrounding), a touch wakes it
    engine.resume();
  }, []);

  return (
    <View style={styles.root}>
      {/* stage: particles behind, morph pad on top capturing touches */}
      <Particles />
      <MorphPad onTouchStart={collapse} />

      <TopBar
        hidden={expanded !== null}
        onOpenLibrary={() => setLibOpen(true)}
        onRecord={recorder.start}
      />
      <Knobs expanded={expanded} onExpand={setExpanded} />

      {expanded !== null && (
        <Pressable style={[styles.closeKnob, { top: insets.top + 12 }]} onPress={collapse}>
          <Text style={styles.closeKnobText}>✕</Text>
        </Pressable>
      )}

      <Library visible={libOpen} onClose={() => setLibOpen(false)} />
      <RecordSheet onStop={recorder.stop} onCancel={recorder.cancel} />

      {!started && <StartScreen onStart={onStart} />}
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    DMMono_300Light,
    DMMono_400Regular,
    DMMono_500Medium,
  });

  if (!fontsLoaded) {
    return <View style={styles.root} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Synth />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  closeKnob: {
    position: "absolute",
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 6,
  },
  closeKnobText: { color: "#fff", fontSize: 20 },
});
