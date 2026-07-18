import { StyleSheet, View } from "react-native";

import { KNOB_ORDER, type KnobKey } from "../core/params";
import { Knob } from "./Knob";

export function Knobs({
  expanded,
  onExpand,
}: {
  expanded: KnobKey | null;
  onExpand: (k: KnobKey) => void;
}) {
  return (
    <View style={styles.row} pointerEvents="box-none">
      {KNOB_ORDER.map((k) => (
        <Knob key={k} knobKey={k} expanded={expanded === k} onExpand={onExpand} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 40,
    flexDirection: "row",
    gap: 40,
    alignItems: "flex-end",
    justifyContent: "center",
  },
});
