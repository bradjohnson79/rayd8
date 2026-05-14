import { useCallback, useEffect, useRef, useState } from "react";
import {
  ENERGY_GLYPHS,
  FULL_GLYPHS,
  PHYSICAL_GLYPHS,
} from "../assets/appImages/glyphs";
import { COLOR_THEMES, GLYPH_COLORS, Mode, Speed } from "../constants/hamsa";

export const useHamsaLogic = () => {
  const [mode, setMode] = useState<Mode>("FULL BODY");
  const [speed, setSpeed] = useState<Speed>("STANDARD");
  const [currentGlyphs, setCurrentGlyphs] = useState<any[]>([]);
  const [currentColors, setCurrentColors] = useState<string[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentThemeIndex, setCurrentThemeIndex] = useState<number>(0);
  const [glyphsMode, setGlyphsMode] = useState<Mode | null>(null);

  const pickRandomGlyphs = useCallback(() => {
    let source = FULL_GLYPHS;
    if (mode === "PHYSICAL BODY") source = PHYSICAL_GLYPHS;
    if (mode === "ENERGY BODY") source = ENERGY_GLYPHS;

    const shuffledGlyphs = [...source].sort(() => 0.5 - Math.random());
    setCurrentGlyphs(shuffledGlyphs.slice(0, 12));

    // Also shuffle colors
    const shuffledColors = [...GLYPH_COLORS].sort(() => 0.5 - Math.random());
    setCurrentColors(shuffledColors);

    setGlyphsMode(mode);
  }, [mode]);

  // Keep a ref to the latest pickRandomGlyphs to use in interval
  const pickRandomGlyphsRef = useRef(pickRandomGlyphs);
  useEffect(() => {
    pickRandomGlyphsRef.current = pickRandomGlyphs;
  }, [pickRandomGlyphs]);

  useEffect(() => {
    if (isPlaying && (currentGlyphs.length === 0 || glyphsMode !== mode)) {
      pickRandomGlyphs();
    }
  }, [isPlaying, pickRandomGlyphs, currentGlyphs.length, glyphsMode, mode]);

  const lastThemeRef = useRef<number>(-1);
  const themeBagRef = useRef<number[]>([]);

  const pickRandomTheme = useCallback(() => {
    const count = COLOR_THEMES.length;

    // Refill bag if empty
    if (themeBagRef.current.length === 0) {
      themeBagRef.current = Array.from({ length: count }, (_, i) => i);
      // Shuffle
      themeBagRef.current.sort(() => Math.random() - 0.5);

      // Ensure we don't repeat the last played theme immediately after refill
      if (count > 1 && themeBagRef.current[0] === lastThemeRef.current) {
        // Swap first with last to avoid repeat
        const temp = themeBagRef.current[0];
        themeBagRef.current[0] =
          themeBagRef.current[themeBagRef.current.length - 1];
        themeBagRef.current[themeBagRef.current.length - 1] = temp;
      }
    }

    const idx = themeBagRef.current.shift();
    if (idx !== undefined) {
      lastThemeRef.current = idx;
      setCurrentThemeIndex(idx);
    }
  }, []);

  // Animation Logic
  useEffect(() => {
    if (!isPlaying) return;

    let cycleMs = 15000; // Standard
    if (speed === "SLOW") cycleMs = 30000;
    if (speed === "FAST") cycleMs = 5000;

    const intervalId = setInterval(() => {
      // Single source of truth for all transitions
      pickRandomGlyphsRef.current();
      pickRandomTheme();
    }, cycleMs);

    return () => {
      clearInterval(intervalId);
    };
  }, [isPlaying, speed, pickRandomTheme]);

  const startAnimation = () => {
    setIsPlaying((prev) => !prev);
  };

  return {
    mode,
    setMode,
    speed,
    setSpeed,
    currentGlyphs,
    currentColors,
    pickRandomGlyphs,
    startAnimation,
    currentTheme: COLOR_THEMES[currentThemeIndex],
    isPlaying,
  };
};
