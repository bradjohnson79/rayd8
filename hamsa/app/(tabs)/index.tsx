import { useEffect, useState } from "react";
import {
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { AboutModal } from "../../components/hamsa/AboutModal";
import { AuraBackground } from "../../components/hamsa/AuraBackground";
import { CenterDisplay } from "../../components/hamsa/CenterDisplay";
import { HandOutlineGlow } from "../../components/hamsa/HandOutlineGlow";
import { LeftControls } from "../../components/hamsa/LeftControls";
import { RightControls } from "../../components/hamsa/RightControls";
import { useHamsaAudio } from "../../hooks/useHamsaAudio";
import { useHamsaLogic } from "../../hooks/useHamsaLogic";
import { useHamsaRenderEngine } from "../../hooks/useHamsaRenderEngine";
import { useKeepAwake } from "../../hooks/useKeepAwake";

type LockableScreenOrientation = ScreenOrientation & {
  lock?: (orientation: OrientationLockType) => Promise<void>;
};

const HamsaHealingScreen = () => {
  const {
    mode,
    setMode,
    speed,
    setSpeed,
    currentGlyphs,
    currentColors,
    pickRandomGlyphs,
    startAnimation,
    currentTheme,
    isPlaying,
  } = useHamsaLogic();

  // Control screen sleep behavior based on isPlaying state
  useKeepAwake(isPlaying);

  const renderState = useHamsaRenderEngine(currentTheme, speed, isPlaying);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [handLayout, setHandLayout] = useState({
    width: 0,
    height: 0,
    x: 0,
    y: 0,
  });

  const [isAboutVisible, setIsAboutVisible] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lastTapAt, setLastTapAt] = useState(0);

  const { isMuted, toggleMute, setShouldPlay } = useHamsaAudio();

  const isWeb = Platform.OS === "web";
  const isMobileWeb = isWeb && Math.min(screenWidth, screenHeight) < 760;
  const enforceMobileStage = isMobileWeb && (isPlaying || isFullscreen);
  const mobileStageWidth = isMobileWeb
    ? Math.min(screenWidth, screenHeight * (16 / 9))
    : screenWidth;
  const mobileStageHeight = isMobileWeb
    ? Math.min(screenHeight, screenWidth * (9 / 16))
    : screenHeight;
  const stageWidth = enforceMobileStage ? mobileStageWidth : screenWidth;
  const stageHeight = enforceMobileStage ? mobileStageHeight : screenHeight;
  const isCompactWeb = isWeb && (screenWidth < 920 || screenHeight < 620);
  const sideWidth = isWeb
    ? Math.max(128, Math.min(isCompactWeb ? 180 : 230, screenWidth * 0.22))
    : undefined;

  useEffect(() => {
    setShouldPlay(isPlaying);
  }, [isPlaying, setShouldPlay]);

  useEffect(() => {
    if (!isWeb || typeof document === "undefined") {
      return;
    }

    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && document.fullscreenElement) {
        void document.exitFullscreen();
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isWeb]);

  const toggleFullscreen = async () => {
    if (!isWeb || typeof document === "undefined") {
      return;
    }

    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    await document.documentElement.requestFullscreen();
  };

  const requestFullscreenSafe = async () => {
    if (!isWeb || typeof document === "undefined" || document.fullscreenElement) {
      return;
    }

    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // Fullscreen can be blocked by the browser; START should still work.
    }
  };

  const lockMobileLandscape = async () => {
    if (!isMobileWeb || typeof document === "undefined") {
      return;
    }

    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    }

    const orientation = screen.orientation as LockableScreenOrientation | undefined;
    await orientation?.lock?.("landscape").catch(() => {
      // Some mobile browsers, especially iOS Safari, do not expose orientation lock.
    });
  };

  const handleStart = async () => {
    if (!isPlaying) {
      await requestFullscreenSafe();
      await lockMobileLandscape();
    }

    startAnimation();
  };

  const handleViewportPress = () => {
    if (!isWeb || typeof document === "undefined" || !document.fullscreenElement) {
      return;
    }

    const now = Date.now();
    if (now - lastTapAt < 320) {
      setLastTapAt(0);
      void document.exitFullscreen();
      return;
    }

    setLastTapAt(now);
  };

  return (
    <AuraBackground
      style={styles.container}
      speed={speed === "FAST" ? 1.5 : speed === "SLOW" ? 0.5 : 1.0}
      isPlaying={isPlaying}
    >
      <StatusBar hidden />

      <SafeAreaProvider>
        <TouchableOpacity
          activeOpacity={1}
          onPress={handleViewportPress}
          style={[
            styles.viewportPressLayer,
            enforceMobileStage && styles.mobileWebViewport,
          ]}
        >
          {/* Hand Glow Layer - Now inside ScrollView to follow the hand */}
          {(handLayout.width > 0 || Platform.OS === "web") && (
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <HandOutlineGlow
                width={stageWidth}
                height={stageHeight}
                handWidth={handLayout.width}
                handHeight={handLayout.height}
                handX={undefined} // On web, always center relative to canvas
                handY={undefined}
                renderState={renderState}
                style={StyleSheet.absoluteFill}
              />
            </View>
          )}

          <SafeAreaView
            style={[
              styles.container,
              isWeb && styles.webContainer,
              enforceMobileStage && styles.mobileWebStage,
              enforceMobileStage && { width: stageWidth, height: stageHeight },
            ]}
          >
            <View
              style={[
                styles.sideControlContainer,
                isWeb && styles.webLeftControlContainer,
                isWeb && { width: sideWidth },
              ]}
            >
              <LeftControls
                speed={speed}
                setSpeed={setSpeed}
                isPlaying={isPlaying}
                onOpenAbout={() => setIsAboutVisible(true)}
              />
            </View>
            <View
              style={[
                styles.centerControlContainer,
                isWeb && styles.webCenterControlContainer,
              ]}
            >
              <CenterDisplay
                currentGlyphs={currentGlyphs}
                currentColors={currentColors}
                onStart={handleStart}
                isPlaying={isPlaying}
                currentTheme={currentTheme}
                speed={speed}
                renderState={renderState}
                onHandLayout={setHandLayout}
              />
            </View>

            <View
              style={[
                styles.sideControlContainer,
                isWeb && styles.webRightControlContainer,
                isWeb && { width: sideWidth },
              ]}
            >
              <RightControls
                mode={mode}
                setMode={setMode}
                isMuted={isMuted}
                toggleMute={toggleMute}
                isPlaying={isPlaying}
              />
            </View>
          </SafeAreaView>
        </TouchableOpacity>
      </SafeAreaProvider>

      {isWeb && (
        <TouchableOpacity
          activeOpacity={0.75}
          hitSlop={{ bottom: 10, left: 10, right: 10, top: 10 }}
          onPress={toggleFullscreen}
          style={styles.fullscreenButton}
        >
          <Text style={styles.fullscreenButtonText}>
            {isFullscreen ? "EXIT FULLSCREEN" : "FULLSCREEN"}
          </Text>
        </TouchableOpacity>
      )}

      <AboutModal
        visible={isAboutVisible}
        onClose={() => setIsAboutVisible(false)}
      />
    </AuraBackground>
  );
};

export default HamsaHealingScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: Platform.OS === "web" ? "0%" : "2%",
    paddingHorizontal: "2%",
    paddingRight: Platform.OS === "android" ? "3%" : undefined,
  },
  viewportPressLayer: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
  },
  mobileWebViewport: {
    alignItems: "center",
    justifyContent: "center",
  },
  webContainer: {
    minHeight: 0,
    overflow: "hidden",
    paddingHorizontal: "1.5%",
    position: "relative",
  },
  mobileWebStage: {
    aspectRatio: 16 / 9,
    flex: 0,
    maxHeight: "100%",
    maxWidth: "100%",
  },

  centerControlContainer: {
    flex: 3,
    paddingBottom: Platform.OS === "web" ? "2%" : "2%",
    minWidth: 0,
  },
  webCenterControlContainer: {
    paddingBottom: "1%",
  },

  sideControlContainer: {
    flex: 1,
    zIndex: 10,
    paddingVertical: Platform.OS === "web" ? "2%" : "2%",
    minWidth: 0,
  },
  webLeftControlContainer: {
    position: "absolute",
    bottom: 0,
    left: "3.5%",
    top: 0,
  },
  webRightControlContainer: {
    position: "absolute",
    bottom: 0,
    right: "3.5%",
    top: 0,
  },
  fullscreenButton: {
    position: "absolute",
    bottom: 16,
    right: 16,
    zIndex: 50,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    backgroundColor: "rgba(18, 18, 32, 0.58)",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  fullscreenButtonText: {
    color: "white",
    fontSize: 11,
    fontWeight: "bold",
    letterSpacing: 1,
  },
});
