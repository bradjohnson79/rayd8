import React from "react";
import {
  Dimensions,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { Easing, Keyframe } from "react-native-reanimated";
import HamsaSvg from "../../assets/appImages/hamsa_bg/hamsa.svg";
import { GlyphBackground } from "../../components/hamsa/GlyphBackground";
import {
  ColorTheme,
  GLYPH_COLORS,
  GLYPH_POSITIONS,
  Speed,
} from "../../constants/hamsa";
import { HamsaRenderState } from "../../hooks/useHamsaRenderEngine";
import { SmoothImage } from "./SmoothImage";
// import { HandOutlineGlow } from "./HandOutlineGlow"; // Removed as it is lifted up

const { width, height } = Dimensions.get("window");
const isTablet = Math.min(width, height) >= 600;

// Unified animation configuration
const ANIMATION_DURATION = 1000;
const ANIMATION_EASING = Easing.out(Easing.exp);

const SoftZoomIn = new Keyframe({
  0: {
    opacity: 0,
    transform: [{ scale: 0.8 }],
  },
  100: {
    opacity: 1,
    transform: [{ scale: 1 }],
  },
}).duration(ANIMATION_DURATION);

const SoftZoomOut = new Keyframe({
  0: {
    opacity: 1,
    transform: [{ scale: 1 }],
  },
  100: {
    opacity: 0,
    transform: [{ scale: 0.8 }],
  },
}).duration(ANIMATION_DURATION);

interface CenterDisplayProps {
  currentGlyphs: any[];
  currentColors?: string[];
  onStart: () => void;
  isPlaying?: boolean;
  currentTheme?: ColorTheme;
  speed: Speed;
  renderState: HamsaRenderState;
  onHandLayout?: (layout: {
    width: number;
    height: number;
    x: number;
    y: number;
  }) => void;
}

const HAND_ASPECT_RATIO = 460.8 / 259.2;
const GLYPH_SIZE = 78;
const ICON_SIZE = 43;

export const CenterDisplay: React.FC<CenterDisplayProps> = ({
  currentGlyphs,
  currentColors,
  onStart,
  isPlaying = false,
  currentTheme,
  speed,
  renderState,
  onHandLayout,
}) => {
  // const renderState = useHamsaRenderEngine(currentTheme, speed, isPlaying); // Lifted up

  const handInnerRef = React.useRef<View>(null);

  // Use passed currentColors if available, otherwise fallback to local shuffle (for safety)
  const colorsToUse = React.useMemo(() => {
    if (currentColors && currentColors.length > 0) {
      return currentColors;
    }
    // Fallback: Fisher-Yates shuffle for better randomness
    const colors = [...GLYPH_COLORS];
    for (let i = colors.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [colors[i], colors[j]] = [colors[j], colors[i]];
    }
    return colors;
  }, [currentColors, currentGlyphs]); // Depend on currentColors first

  const renderHand = () => {
    const svgStyle = {
      width: "100%",
      height: "100%",
    } as const;

    return typeof HamsaSvg === "function" ? (
      <HamsaSvg {...svgStyle} preserveAspectRatio="xMidYMid meet" />
    ) : (
      <Image source={HamsaSvg as any} style={svgStyle} resizeMode="contain" />
    );
  };

  return (
    <View style={styles.centerColumn}>
      <View style={styles.handContainer}>
        <View
          ref={handInnerRef}
          style={styles.handInnerContainer}
          onLayout={() => {
            handInnerRef.current?.measure((_x, _y, w, h, pageX, pageY) => {
              if (onHandLayout) {
                onHandLayout({ width: w, height: h, x: pageX, y: pageY });
              }
            });
          }}
        >
          {/* Base Hand Layer */}
          {renderHand()}

          {/* Overlay Glyphs */}
          {currentGlyphs.map((glyph, index) => {
            if (index >= GLYPH_POSITIONS.length) return null;
            const pos = GLYPH_POSITIONS[index];
            const color = colorsToUse[index % colorsToUse.length];

            const isWeb = Platform.OS === "web";

            return (
              <View
                key={index}
                style={[
                  styles.glyphContainer,
                  {
                    top: pos.top,
                    left: pos.left,
                    transform: [
                      { translateX: -GLYPH_SIZE / 2 },
                      { translateY: -GLYPH_SIZE / 2 },
                    ],
                  },
                ]}
              >
                <Animated.View
                  key={isWeb ? index : glyph}
                  entering={SoftZoomIn}
                  exiting={SoftZoomOut}
                  style={{
                    position: "absolute",
                    width: "100%",
                    height: "100%",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <GlyphBackground
                    style={{
                      position: "absolute",
                      width: GLYPH_SIZE,
                      height: GLYPH_SIZE,
                      borderRadius: GLYPH_SIZE / 2,
                      zIndex: 0,
                      elevation: 0,
                    }}
                    width={GLYPH_SIZE}
                    height={GLYPH_SIZE}
                    renderState={renderState}
                    glyphColor={color}
                    speed={speed}
                  />

                  <SmoothImage
                    source={glyph}
                    style={[
                      styles.glyphImage,
                      {
                        position: "absolute",
                        zIndex: 1,
                        width: ICON_SIZE,
                        height: ICON_SIZE,
                      },
                    ]}
                  />
                </Animated.View>
              </View>
            );
          })}
        </View>
      </View>

      <TouchableOpacity style={styles.startButton} onPress={onStart}>
        <Text style={styles.startButtonText}>
          {isPlaying ? "STOP" : "START"}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  centerColumn: {
    flex: 2,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 0,
    position: "relative", // Ensure absolute children are relative to this
    minWidth: 0,
    minHeight: 0,
  },
  timerContainer: {
    position: "absolute",
    top: 20, // Fixed unit instead of % for safety
    alignSelf: "center",
    zIndex: 999, // High zIndex
    elevation: 10, // High elevation for Android
    backgroundColor: "rgba(0,0,0,0.7)", // Darker background
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  timerText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
    fontVariant: ["tabular-nums"], // Monospaced numbers if supported
  },
  handContainer: {
    flex: 1,
    width: "100%",
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
    minHeight: 0,
  },
  handInnerContainer: {
    // Maintain the hand's aspect ratio and scale it up.
    // We use height as the primary constraint to ensure it fits vertically.
    height: Platform.OS === "web" ? "88%" : isTablet ? "90%" : "110%",
    maxWidth: "100%",
    aspectRatio: HAND_ASPECT_RATIO,
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  glyphContainer: {
    position: "absolute",
    width: GLYPH_SIZE,
    height: GLYPH_SIZE,
    justifyContent: "center",
    alignItems: "center",
  },
  glyphImage: {
    // Sizes are now controlled via ICON_SIZE constant
  },
  startButton: {
    backgroundColor: "#84cc16", // Lime green
    paddingVertical: 10,
    paddingHorizontal: 40,
    borderRadius: 25,
    elevation: 5,
  },
  startButtonDisabled: {
    backgroundColor: "#a3a3a3", // Grey
    opacity: 0.8,
  },
  startButtonText: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});
