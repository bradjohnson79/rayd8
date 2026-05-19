import { useEffect, useState } from "react";
import {
    Platform,
    StatusBar,
    StyleSheet,
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

  const { isMuted, toggleMute, setShouldPlay } = useHamsaAudio();

  useEffect(() => {
    setShouldPlay(isPlaying);
  }, [isPlaying, setShouldPlay]);

  const requestFullscreenSafe = async () => {
    if (Platform.OS !== "web" || typeof document === "undefined" || document.fullscreenElement) {
      return;
    }

    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // Fullscreen can be blocked by the browser; START should still work.
    }
  };

  const handleStart = async () => {
    if (!isPlaying) {
      await requestFullscreenSafe();
    }

    startAnimation();
  };

  return (
    <AuraBackground
      style={styles.container}
      speed={speed === "FAST" ? 1.5 : speed === "SLOW" ? 0.5 : 1.0}
      isPlaying={isPlaying}
    >
      <StatusBar hidden />

      {/* Hand Glow Layer - Absolute Positioned behind content */}
      {handLayout.width > 0 && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <HandOutlineGlow
            width={screenWidth}
            height={screenHeight}
            handWidth={handLayout.width}
            handHeight={handLayout.height}
            handX={handLayout.x}
            handY={handLayout.y}
            renderState={renderState}
            style={StyleSheet.absoluteFill}
          />
        </View>
      )}

      <SafeAreaProvider>
        <SafeAreaView style={styles.container}>
          <View style={styles.sideControlContainer}>
            <LeftControls
              speed={speed}
              setSpeed={setSpeed}
              isPlaying={isPlaying}
              onOpenAbout={() => setIsAboutVisible(true)}
            />
          </View>

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

          <View style={styles.sideControlContainer}>
            <RightControls
              mode={mode}
              setMode={setMode}
              isMuted={isMuted}
              toggleMute={toggleMute}
              isPlaying={isPlaying}
            />
          </View>
        </SafeAreaView>
      </SafeAreaProvider>

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
    paddingVertical: "2%",
    paddingHorizontal: "2%",
    paddingRight: Platform.OS === "android" ? "3%" : undefined,
  },
  sideControlContainer: {
    flex: 1,
    zIndex: 10,
  },
});
