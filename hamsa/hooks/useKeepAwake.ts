import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useEffect } from "react";
import { AppState, AppStateStatus } from "react-native";

/**
 * A reusable hook to manage screen sleep behavior.
 *
 * @param shouldKeepAwake - Boolean indicating if the screen should stay awake.
 * @param tag - Optional tag for the keep awake instance.
 */
export const useKeepAwake = (
  shouldKeepAwake: boolean,
  tag: string = "hamsa-healing-keep-awake",
) => {
  useEffect(() => {
    let isActive = shouldKeepAwake;

    const toggleKeepAwake = async (enable: boolean) => {
      if (enable) {
        try {
          await activateKeepAwakeAsync(tag);
        } catch (error) {
          console.warn("Failed to activate keep awake:", error);
        }
      } else {
        try {
          await deactivateKeepAwake(tag);
        } catch (error) {
          console.warn("Failed to deactivate keep awake:", error);
        }
      }
    };

    // Initial toggle based on shouldKeepAwake
    toggleKeepAwake(isActive);

    // Handle AppState changes to ensure keep awake is maintained when returning to foreground
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === "active" && isActive) {
        toggleKeepAwake(true);
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    return () => {
      isActive = false;
      toggleKeepAwake(false);
      subscription.remove();
    };
  }, [shouldKeepAwake, tag]);
};
