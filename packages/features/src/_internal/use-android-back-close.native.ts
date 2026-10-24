import { useEffect, useRef } from "react";
import { BackHandler, Platform } from "react-native";

/**
 * Android hardware back closes the OPEN sheet instead of popping whatever
 * navigator sits underneath it (the tab navigator jumped back to Today while
 * the quick-add sheet stayed open — kit FormSheet has no back handling on
 * Android). The listener is registered only while `open` is true and depends
 * on nothing else: BackHandler calls listeners newest-first, so a picker
 * opened on top of a sheet registers later and wins, and the parent's
 * listener is never re-registered while the child is up.
 */
export function useAndroidBackClose(open: boolean, onClose: () => void): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (Platform.OS !== "android" || !open) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onCloseRef.current();
      return true;
    });
    return () => sub.remove();
  }, [open]);
}
