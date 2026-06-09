import spinners from "cli-spinners";
import { createPulse, createWave, type SpinnerOptions } from "../src/index";

export const builtInSpinnerNames = Object.keys(spinners).sort() as Array<
  keyof typeof spinners
>;

export const galleryPageSize = 12;

export const customSpinners: Array<{
  label: string;
  options: SpinnerOptions;
}> = [
  {
    label: "Pulse",
    options: {
      frames: ["◆", "◇", "◈", "◇"],
      interval: 100,
      color: createPulse(["#38bdf8", "#a78bfa", "#f472b6"]),
    },
  },
  {
    label: "Wave",
    options: {
      frames: ["■■■■■■■■", "■■■■■■■■", "■■■■■■■■", "■■■■■■■■"],
      interval: 80,
      color: createWave(["#22d3ee", "#3b82f6", "#8b5cf6", "#ec4899"]),
    },
  },
  {
    label: "Orbit",
    options: {
      frames: [
        "● · · ·",
        "· ● · ·",
        "· · ● ·",
        "· · · ●",
        "· · ● ·",
        "· ● · ·",
      ],
      interval: 90,
      color: "#fbbf24",
    },
  },
];

export const scannerFrames = [
  "█░░░░░░░░░░░",
  "▓█░░░░░░░░░░",
  "▒▓█░░░░░░░░░",
  "░▒▓█░░░░░░░░",
  "░░▒▓█░░░░░░░",
  "░░░▒▓█░░░░░░",
  "░░░░▒▓█░░░░░",
  "░░░░░▒▓█░░░░",
  "░░░░░░▒▓█░░░",
  "░░░░░░░▒▓█░░",
  "░░░░░░░░▒▓█░",
  "░░░░░░░░░▒▓█",
  "░░░░░░░░░░▒█",
  "░░░░░░░░░▒█▓",
  "░░░░░░░░▒█▓▒",
  "░░░░░░░▒█▓▒░",
  "░░░░░░▒█▓▒░░",
  "░░░░░▒█▓▒░░░",
  "░░░░▒█▓▒░░░░",
  "░░░▒█▓▒░░░░░",
  "░░▒█▓▒░░░░░░",
  "░▒█▓▒░░░░░░░",
  "▒█▓▒░░░░░░░░",
  "█▓▒░░░░░░░░░",
];

export const opencodeFrames = Array.from({ length: 15 }, (_, position) =>
  Array.from({ length: 15 }, (_, index) =>
    index === position ? "▣" : "■",
  ).join(""),
);

export const exampleDefinitions = [
  {
    name: "Basic",
    description: "Lifecycle, labels, colors, and named spinners",
  },
  {
    name: "Built-in gallery",
    description: `Browse all ${builtInSpinnerNames.length} cli-spinners`,
  },
  {
    name: "Custom animations",
    description: "Custom frames, pulse colors, and color waves",
  },
  {
    name: "Knight Rider scanner",
    description: "A custom bidirectional trail animation",
  },
  {
    name: "OpenCode trail",
    description: "A long custom frame sequence with a color wave",
  },
] as const;
