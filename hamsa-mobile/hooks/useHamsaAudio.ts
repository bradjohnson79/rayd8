import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus, Platform } from "react-native";

export const useHamsaAudio = () => {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isMuted, setIsMuted] = useState(false); // Default sound ON
  const [shouldPlay, setShouldPlay] = useState(false); // Default animation STOPPED

  // Refs to avoid stale closures and to allow immediate checks inside async flows
  const soundRef = useRef<Audio.Sound | null>(null);
  const isMutedRef = useRef(isMuted);
  const shouldPlayRef = useRef(shouldPlay);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);
  useEffect(() => {
    shouldPlayRef.current = shouldPlay;
  }, [shouldPlay]);

  // Load sound once
  async function loadSound() {
    console.log("Loading Sound");
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
        shouldDuckAndroid: true,
        // optional: playThroughEarpieceAndroid: false,
      });

      const { sound: newSound } = await Audio.Sound.createAsync(
        require("../assets/audio/hamsa_soundtrack.mp3"),
        {
          isLooping: true,
          shouldPlay: false,
          volume: isMutedRef.current ? 0 : 1,
        },
      );

      // Save instance
      soundRef.current = newSound;
      setSound(newSound);

      if (Platform.OS === "android") {
        try {
          await newSound.setIsMutedAsync(true);
          await newSound.playAsync();
          await newSound.pauseAsync();
          await newSound.setIsMutedAsync(isMutedRef.current);
          await newSound.setVolumeAsync(isMutedRef.current ? 0 : 1);
        } catch (err) {
          console.log("Android prewarm failed", err);
        }
      }

      // If user already requested play before load finished, start playback now (unless muted)
      if (shouldPlayRef.current && !isMutedRef.current) {
        // attempt to play; swallow errors
        try {
          await newSound.playAsync();
        } catch (err) {
          console.log("Error playing after load", err);
        }
      }
    } catch (error) {
      console.log("Error loading sound", error);
    }
  }

  useEffect(() => {
    loadSound();

    const subscription = AppState.addEventListener(
      "change",
      (nextAppState: AppStateStatus) => {
        // Pause when backgrounded (optional; helpful on Android)
        if (nextAppState !== "active" && soundRef.current) {
          soundRef.current.pauseAsync().catch(() => {});
        } else if (
          nextAppState === "active" &&
          shouldPlayRef.current &&
          soundRef.current &&
          !isMutedRef.current
        ) {
          soundRef.current.playAsync().catch(() => {});
        }
      },
    );

    return () => {
      subscription.remove();
      if (soundRef.current) {
        console.log("Unloading Sound");
        soundRef.current
          .unloadAsync()
          .catch((err) => console.log("Error unloading sound", err));
      }
    };
  }, []);

  // Sync playback whenever relevant state or sound instance changes
  useEffect(() => {
    const managePlayback = async () => {
      const s = soundRef.current;
      if (!s) return;

      try {
        const status = await s.getStatusAsync();
        if (!status.isLoaded) return;

        if (shouldPlay && !isMuted) {
          // ensure audible
          await s.setIsMutedAsync(false);
          await s.setVolumeAsync(1);
          if (!status.isPlaying) await s.playAsync();
        } else {
          // either paused by user or muted
          if (status.isPlaying) await s.pauseAsync();
          // if muted state changed, apply it to the player
          await s.setIsMutedAsync(isMuted);
          if (isMuted) await s.setVolumeAsync(0);
        }
      } catch (error) {
        console.log("Error managing playback", error);
      }
    };

    managePlayback();
  }, [sound, shouldPlay, isMuted]);

  // toggleMute now also updates the actual Sound instance immediately
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      isMutedRef.current = next;
      // immediately propagate to native sound
      if (soundRef.current) {
        // prefer setIsMutedAsync (works cross-platform)
        soundRef.current
          .setIsMutedAsync(next)
          .catch((err) => console.log("Error setIsMutedAsync", err));
        // ensure volume consistent on Android
        soundRef.current
          .setVolumeAsync(next ? 0 : 1)
          .catch((err) => console.log("Error setVolumeAsync", err));
        // If unmuting and shouldPlay is true, ensure playback starts
        if (!next && shouldPlayRef.current) {
          soundRef.current.playAsync().catch((err) => {
            console.log("Error playAsync after unmute", err);
          });
        }
      }
      return next;
    });
  }, []);

  // expose setShouldPlay as before; ensure immediate effect on native sound
  const setShouldPlaySafe = useCallback((value: boolean) => {
    setShouldPlay(value);
    shouldPlayRef.current = value;
    // try start/stop immediately on the native sound if available
    const s = soundRef.current;
    if (!s) return;
    (async () => {
      try {
        const status = await s.getStatusAsync();
        if (!status.isLoaded) return;
        if (value && !isMutedRef.current) {
          await s.playAsync();
        } else if (!value && status.isPlaying) {
          await s.pauseAsync();
        }
      } catch (err) {
        console.log("Error toggling play state directly", err);
      }
    })();
  }, []);

  return {
    isMuted,
    toggleMute,
    setShouldPlay: setShouldPlaySafe,
  };
};
