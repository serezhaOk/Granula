// A single G/P/D/S knob — SVG arc in the web build (index.html 867-925), here a
// Skia arc. Vertical drag changes the value; touching it expands the knob (and
// hides the top bar via the parent). The 270° arc fills value→max, matching the
// web's 75%-of-circle dial.

import { useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { Canvas, Path, Skia } from "@shopify/react-native-skia";

import { controller } from "../core/controller";
import { KNOBS, type KnobKey } from "../core/params";

const START_DEG = 135;
const TOTAL_SWEEP = 270;

function arcPath(size: number, sweep: number) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.46;
  const path = Skia.Path.Make();
  path.addArc(Skia.XYWHRect(cx - r, cy - r, r * 2, r * 2), START_DEG, sweep);
  return path;
}

export function Knob({
  knobKey,
  expanded,
  onExpand,
}: {
  knobKey: KnobKey;
  expanded: boolean;
  onExpand: (k: KnobKey) => void;
}) {
  const K = KNOBS[knobKey];
  const size = expanded ? 87 : 38;
  const stroke = expanded ? 6 : 3;
  const [frac, setFrac] = useState((K.value - K.min) / (K.max - K.min));
  const startV = useRef(K.value);

  const applyDelta = (translationY: number) => {
    const dv = (-translationY / 150) * (K.max - K.min);
    K.value = Math.max(K.min, Math.min(K.max, startV.current + dv));
    setFrac((K.value - K.min) / (K.max - K.min));
    controller.saveKnobs();
  };
  const begin = () => {
    startV.current = K.value;
    onExpand(knobKey);
  };

  const gesture = Gesture.Pan()
    .onBegin(() => runOnJS(begin)())
    .onUpdate((e) => runOnJS(applyDelta)(e.translationY));

  const track = arcPath(size, TOTAL_SWEEP);
  const value = arcPath(size, TOTAL_SWEEP * frac);

  return (
    <GestureDetector gesture={gesture}>
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        {expanded && (
          <View style={styles.tip}>
            <Text style={styles.tipText}>
              {K.label} · {K.fmt(K.value)}
            </Text>
          </View>
        )}
        <Canvas style={StyleSheet.absoluteFill}>
          <Path path={track} style="stroke" strokeWidth={2} strokeCap="round" color="rgba(255,255,255,0.22)" />
          <Path path={value} style="stroke" strokeWidth={stroke} strokeCap="round" color="#ffc700" />
        </Canvas>
        <Text style={[styles.letter, { fontSize: expanded ? 22 : 13 }]}>{knobKey}</Text>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  letter: {
    color: "#fff",
    fontWeight: "700",
    fontFamily: "DMMono_500Medium",
  },
  tip: {
    position: "absolute",
    bottom: "100%",
    marginBottom: 12,
    backgroundColor: "rgba(30,30,30,0.9)",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
  },
  tipText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
    fontFamily: "DMMono_400Regular",
  },
});
