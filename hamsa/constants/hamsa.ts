// Define types
export type Mode = "PHYSICAL BODY" | "ENERGY BODY" | "FULL BODY";
export type Speed = "STANDARD" | "SLOW" | "FAST";

export type ColorTheme = {
  name: string;
  primary: string;
  secondary: string[];
  particleRange: [string, string, string?];
  accent?: string;
  backgroundTint?: string;
  glyphTint: string;
};

const randomRGB = () => {
  const min = 70; // dull colors avoid
  const max = 255;

  const r = Math.floor(Math.random() * (max - min) + min);
  const g = Math.floor(Math.random() * (max - min) + min);
  const b = Math.floor(Math.random() * (max - min) + min);

  return `rgb(${r}, ${g}, ${b})`;
};

export const COLOR_THEMES: ColorTheme[] = [
  {
    name: "Violet Deep",
    primary: randomRGB(),
    secondary: [randomRGB(), randomRGB()],
    particleRange: [randomRGB(), randomRGB()],
    accent: randomRGB(),
    backgroundTint: randomRGB(),
    glyphTint: "#AA00FF",
  },
  {
    name: "Magenta Rose",
    primary: randomRGB(),
    secondary: [randomRGB(), randomRGB()],
    particleRange: [randomRGB(), randomRGB()],
    accent: randomRGB(),
    backgroundTint: randomRGB(),
    glyphTint: "#FF005D",
  },
  {
    name: "Indigo Royal",
    primary: randomRGB(),
    secondary: [randomRGB(), randomRGB()],
    particleRange: [randomRGB(), randomRGB()],
    accent: randomRGB(),
    backgroundTint: randomRGB(),
    glyphTint: "#2962FF",
  },
  {
    name: "Emerald Healing",
    primary: randomRGB(),
    secondary: [randomRGB(), randomRGB()],
    particleRange: [randomRGB(), randomRGB()],
    accent: randomRGB(),
    backgroundTint: randomRGB(),
    glyphTint: "#00C853",
  },
];

export const GLYPH_COLORS = [
  "#6A00F4", // Deep Violet
  "#8E2DE2", // Electric Purple
  "#C77DFF", // Radiant Lavender
  "#E0AAFF", // Soft Lilac

  "#3A0CA3", // Indigo Core
  "#480CA8", // Royal Indigo
  "#4EA8DE", // Mystic Blue
  "#90DBF4", // Soft Indigo

  "#4361EE", // Healing Blue
  "#4CC9F0", // Sky Blue
  "#72EFDD", // Aqua Light
  "#ADE8F4", // Soft Cyan

  "#2D6A4F", // Emerald Green
  "#52B788", // Healing Green
  "#95D5B2", // Mint Glow
  "#D8F3DC", // Soft Green

  "#FFD166", // Solar Gold
  "#FFEA00", // Warm Yellow
  "#FFC300", // Soft Amber
  "#FFF3B0", // Pale Gold

  "#C9184A", // Magenta Core
  "#FF006E", // Hot Pink
  "#FF4D6D", // Rose Glow
  "#FFB3C1", // Soft Pink

  "#F8F9FA", // Soft White
  "#EDEDED", // Pearl White
  "#E9F5FF", // Cool White
];

export const SHARE_MESSAGES = [
  "I’ve been using Hamsa, a calming visual and sound experience designed to support relaxation and balance.",
  "Hamsa is a gentle wellness experience using light, color, sound, and symbolic design to support calm and rejuvenation.",
  "Hamsa – a peaceful visual and audio experience for moments of stillness.",
];

export const APP_URL = "https://hamsahealing.com";

export const GLYPH_POSITIONS: { top: any; left: any }[] = [
  // Middle Finger Column (Center at 50%)
  {
    top: "14%",
    left: "50%",
  },
  {
    top: "22%",
    left: "50%",
  },
  {
    top: "32%",
    left: "50%",
  },
  {
    top: "42%",
    left: "50%",
  },

  // Index Finger Column (Right)
  {
    top: "22%",
    left: "57%",
  },
  {
    top: "32%",
    left: "57%",
  },
  {
    top: "42%",
    left: "57%",
  },

  // Ring Finger Column (Left)
  {
    top: "22%",
    left: "43.5%",
  },
  {
    top: "32%",
    left: "43.5%",
  },
  {
    top: "42%",
    left: "43.5%",
  },

  // Thumb (Right Outer)
  {
    top: "49%",
    left: "64.5%",
  },

  // Pinky (Left Outer)
  {
    top: "49%",
    left: "35.5%",
  },
];
