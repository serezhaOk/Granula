import { useSyncExternalStore } from "react";

import { controller } from "../core/controller";

// Subscribe React to the controller's snapshot (started/playing/current/…).
export function useAppState() {
  return useSyncExternalStore(controller.subscribe, controller.getSnapshot);
}
