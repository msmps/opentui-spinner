import {
  BoxRenderable,
  createCliRenderer,
  TextRenderable,
  type KeyEvent,
} from "@opentui/core";
import { SpinnerRenderable } from "../../src/index";
import type { KnightRiderStyle } from "./utils";
import { createColors, createFrames } from "./utils";

const renderer = await createCliRenderer({ exitOnCtrlC: false });

// State
const colors = [
  "#ff0000",
  "#00ff00",
  "#0088ff",
  "#ff00ff",
  "#ffff00",
  "#00ffff",
];
const backgrounds = [
  "#000000", // Black
  "#ffffff", // White
  "#1a1a1a", // Dark gray
  "#cccccc", // Light gray
  "#0a0a2a", // Dark blue
  "#2a0a0a", // Dark red
];
let colorIndex = 0;
let bgIndex = 0;
let style: KnightRiderStyle = "blocks";
let inactiveFactor = 0.2;
let enableFading = true;
let minAlpha = 0.0;

renderer.setBackgroundColor(backgrounds[bgIndex]);

// Main container - full screen vertical layout
const container = new BoxRenderable(renderer, {
  width: "100%",
  height: "100%",
  flexDirection: "column",
  justifyContent: "space-between",
});
renderer.root.add(container);

// Spinner area - centered
const spinnerArea = new BoxRenderable(renderer, {
  width: "100%",
  height: "100%",
  alignItems: "center",
  justifyContent: "center",
});
container.add(spinnerArea);

// Spinner
const spinner = new SpinnerRenderable(renderer, {
  frames: createFrames({
    color: colors[colorIndex],
    style,
    inactiveFactor,
    enableFading,
    minAlpha,
  }),
  interval: 40,
  color: createColors({
    color: colors[colorIndex],
    style,
    inactiveFactor,
    enableFading,
    minAlpha,
  }),
});
spinnerArea.add(spinner);

// Info area at bottom
const infoArea = new BoxRenderable(renderer, {
  width: "100%",
  paddingLeft: 2,
  paddingRight: 2,
  paddingBottom: 1,
  gap: 1,
  flexDirection: "column",
});
container.add(infoArea);

// Help text
const helpText = new TextRenderable(renderer, {
  content:
    "Controls: [c] cycle color | [b] cycle background | [s] toggle style | [+/-] adjust inactive | [f] toggle fade | [a/A] adjust min alpha | [q] quit",
});
infoArea.add(helpText);

// Status text
const statusText = new TextRenderable(renderer, {
  content: `Color: ${colors[colorIndex]} | BG: ${backgrounds[bgIndex]} | Style: ${style} | Inactive: ${(inactiveFactor * 100).toFixed(0)}% | Fade: ${enableFading ? "ON" : "OFF"} | MinAlpha: ${(minAlpha * 100).toFixed(0)}%`,
});
infoArea.add(statusText);

// Update spinner function
function updateSpinner() {
  spinner.frames = createFrames({
    color: colors[colorIndex],
    style,
    inactiveFactor,
    enableFading,
    minAlpha,
  });
  spinner.color = createColors({
    color: colors[colorIndex],
    style,
    inactiveFactor,
    enableFading,
    minAlpha,
  });
  statusText.content = `Color: ${colors[colorIndex]} | BG: ${backgrounds[bgIndex]} | Style: ${style} | Inactive: ${(inactiveFactor * 100).toFixed(0)}% | Fade: ${enableFading ? "ON" : "OFF"} | MinAlpha: ${(minAlpha * 100).toFixed(0)}%`;
}

// Keyboard controls
renderer.keyInput.on("keypress", (key: KeyEvent) => {
  switch (key.raw) {
    case "c":
      // Cycle color
      colorIndex = (colorIndex + 1) % colors.length;
      updateSpinner();
      break;
    case "b":
      // Cycle background
      bgIndex = (bgIndex + 1) % backgrounds.length;
      renderer.setBackgroundColor(backgrounds[bgIndex]);
      updateSpinner();
      break;
    case "s":
      // Toggle style
      style = style === "diamonds" ? "blocks" : "diamonds";
      updateSpinner();
      break;
    case "+":
    case "=":
      // Increase inactive factor
      inactiveFactor = Math.min(1.0, inactiveFactor + 0.05);
      updateSpinner();
      break;
    case "-":
    case "_":
      // Decrease inactive factor
      inactiveFactor = Math.max(0.0, inactiveFactor - 0.05);
      updateSpinner();
      break;
    case "f":
      // Toggle fade
      enableFading = !enableFading;
      updateSpinner();
      break;
    case "a":
      // Decrease min alpha
      minAlpha = Math.max(0.0, minAlpha - 0.05);
      updateSpinner();
      break;
    case "A":
      // Increase min alpha
      minAlpha = Math.min(1.0, minAlpha + 0.05);
      updateSpinner();
      break;
    case "q":
    case "\u0003": // Ctrl+C
      renderer.destroy();
      break;
    case ".":
      renderer.toggleDebugOverlay();
      break;
  }
});
