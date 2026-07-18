// Full-screen XY morph pad — the native analogue of the web build's #stage
// pointer handling (index.html 939-965). Multi-touch is tracked via a Manual
// gesture (allTouches gives per-finger positions), feeding the shared pointers
// map + morph target. The four corner hints label the grain behaviours.

import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";

import { morph, morphFromPointers, pointers } from "../core/params";

interface TouchLike {
  id: number;
  x: number;
  y: number;
}

function applyTouches(all: TouchLike[], w: number, h: number, onFirstTouch: () => void) {
  const wasEmpty = pointers.size === 0;
  pointers.clear();
  for (const t of all) {
    pointers.set(t.id, { x: t.x / w, y: t.y / h, px: t.x, py: t.y });
  }
  if (!pointers.size) {
    morph.touching = false;
    morph.tx = 0.5;
    morph.ty = 0.5;
  } else {
    if (wasEmpty) onFirstTouch();
    morph.touching = true;
    morphFromPointers();
  }
}

export function MorphPad({ onTouchStart }: { onTouchStart: () => void }) {
  const { width, height } = useWindowDimensions();

  const gesture = Gesture.Manual()
    .onTouchesDown((e) => {
      runOnJS(applyTouches)(e.allTouches as TouchLike[], width, height, onTouchStart);
    })
    .onTouchesMove((e) => {
      runOnJS(applyTouches)(e.allTouches as TouchLike[], width, height, onTouchStart);
    })
    .onTouchesUp((e) => {
      runOnJS(applyTouches)(e.allTouches as TouchLike[], width, height, onTouchStart);
    })
    .onTouchesCancelled((e) => {
      runOnJS(applyTouches)(e.allTouches as TouchLike[], width, height, onTouchStart);
    });

  return (
    <GestureDetector gesture={gesture}>
      <View style={StyleSheet.absoluteFill}>
        <Text style={[styles.corner, styles.tl]}>Halo</Text>
        <Text style={[styles.corner, styles.tr]}>Pulse</Text>
        <Text style={[styles.corner, styles.bl]}>Tide</Text>
        <Text style={[styles.corner, styles.br]}>Chaos</Text>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  corner: {
    position: "absolute",
    fontSize: 10,
    letterSpacing: 2,
    color: "rgba(255,255,255,0.22)",
    textTransform: "uppercase",
    fontWeight: "600",
    fontFamily: "DMMono_500Medium",
  },
  tl: { top: 84, left: 20 },
  tr: { top: 84, right: 20 },
  bl: { bottom: 160, left: 20 },
  br: { bottom: 160, right: 20 },
});
