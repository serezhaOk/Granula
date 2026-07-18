// Sample library sheet — index.html #library (212-233, 287-295, 1182-1255).
// Built-in Pad row, saved samples with inline rename (✎) and delete (✕), and a
// load-file row. Highlights the current sample in yellow.

import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { controller } from "../core/controller";
import type { SampleRow } from "../storage/library";
import { useAppState } from "./useAppState";

export function Library({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { currentId, currentName } = useAppState();
  const [rows, setRows] = useState<SampleRow[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const insets = useSafeAreaInsets();

  const reload = useCallback(async () => {
    setRows(await controller.listSamples());
  }, []);

  useEffect(() => {
    if (visible) reload();
  }, [visible, reload]);

  const selectBuiltin = () => {
    controller.useBuiltin();
    onClose();
  };
  const selectRow = async (row: SampleRow) => {
    await controller.useSample(row);
    onClose();
  };
  const commitRename = async (row: SampleRow) => {
    const name = draft.trim();
    setEditingId(null);
    if (name && name !== row.name) {
      await controller.renameSample(row.id, name);
      reload();
    }
  };
  const remove = async (row: SampleRow) => {
    await controller.deleteSample(row.id);
    reload();
  };
  const loadFile = async () => {
    await controller.importFile();
    onClose();
  };

  const builtinCurrent = currentId === null && currentName.startsWith("Pad");

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]} onPress={() => {}}>
          <Text style={styles.title}>Samples</Text>
          <FlatList
            data={rows}
            keyExtractor={(r) => String(r.id)}
            style={{ maxHeight: 380 }}
            ListHeaderComponent={
              <Pressable style={styles.row} onPress={selectBuiltin}>
                <Text style={[styles.nm, builtinCurrent && styles.current]}>Pad · встроенный</Text>
                <Text style={styles.dur}>5.0s</Text>
              </Pressable>
            }
            ListFooterComponent={
              <Pressable style={styles.row} onPress={loadFile}>
                <Text style={styles.loadFile}>Загрузить файл (mp3 / wav)…</Text>
              </Pressable>
            }
            renderItem={({ item }) => (
              <View style={styles.row}>
                {editingId === item.id ? (
                  <TextInput
                    style={styles.input}
                    value={draft}
                    onChangeText={setDraft}
                    autoFocus
                    maxLength={40}
                    onSubmitEditing={() => commitRename(item)}
                    onBlur={() => commitRename(item)}
                    returnKeyType="done"
                  />
                ) : (
                  <Pressable style={{ flex: 1 }} onPress={() => selectRow(item)}>
                    <Text
                      numberOfLines={1}
                      style={[styles.nm, item.id === currentId && styles.current]}
                    >
                      {item.name}
                    </Text>
                  </Pressable>
                )}
                <Text style={styles.dur}>{item.duration.toFixed(1)}s</Text>
                <Pressable
                  hitSlop={8}
                  onPress={() => {
                    setDraft(item.name);
                    setEditingId(item.id);
                  }}
                >
                  <Text style={styles.icon}>✎</Text>
                </Pressable>
                <Pressable hitSlop={8} onPress={() => remove(item)}>
                  <Text style={styles.icon}>✕</Text>
                </Pressable>
              </View>
            )}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.88)",
    justifyContent: "flex-end",
  },
  sheet: { width: "100%", paddingHorizontal: 20, paddingTop: 20 },
  title: {
    fontSize: 12,
    letterSpacing: 3,
    color: "rgba(255,255,255,0.45)",
    marginBottom: 14,
    textTransform: "uppercase",
    fontFamily: "DMMono_500Medium",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  nm: { flex: 1, color: "#fff", fontSize: 14, fontFamily: "DMMono_400Regular" },
  current: { color: "#ffc700" },
  dur: { color: "rgba(255,255,255,0.45)", fontSize: 12, fontFamily: "DMMono_400Regular" },
  icon: { color: "rgba(255,255,255,0.45)", fontSize: 16, paddingHorizontal: 6 },
  input: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    borderRadius: 6,
    color: "#fff",
    fontSize: 14,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontFamily: "DMMono_400Regular",
  },
  loadFile: { color: "#ffc700", fontWeight: "600", fontSize: 14, fontFamily: "DMMono_500Medium" },
});
