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
renderer.setBackgroundColor("#000000");

// State
const colors = [
  "#ff0000",
  "#00ff00",
  "#0088ff",
  "#ff00ff",
  "#ffff00",
  "#00ffff",
];
let colorIndex = 0;
let style: KnightRiderStyle = "diamonds";
let inactiveFactor = 0.2;

// Container
const container = new BoxRenderable(renderer, {
  paddingTop: 2,
  paddingLeft: 4,
  gap: 2,
  flexDirection: "column",
});
renderer.root.add(container);

// Spinner wrapper
const wrapper = new BoxRenderable(renderer, {
  width: "100%",
  alignItems: "center",
  justifyContent: "center",
});
container.add(wrapper);

// Spinner
const spinner = new SpinnerRenderable(renderer, {
  frames: createFrames({ color: colors[colorIndex], style, inactiveFactor }),
  interval: 40,
  color: createColors({ color: colors[colorIndex], style, inactiveFactor }),
});
wrapper.add(spinner);

// Help text
const helpText = new TextRenderable(renderer, {
  content:
    "Controls: [c] cycle color | [s] toggle style | [+/-] adjust inactive brightness | [q] quit",
});
container.add(helpText);

// Status text
const statusText = new TextRenderable(renderer, {
  content: `Color: ${colors[colorIndex]} | Style: ${style} | Inactive: ${(inactiveFactor * 100).toFixed(0)}%`,
  marginTop: 1,
});
container.add(statusText);

// Update spinner function
function updateSpinner() {
  spinner.frames = createFrames({
    color: colors[colorIndex],
    style,
    inactiveFactor,
  });
  spinner.color = createColors({
    color: colors[colorIndex],
    style,
    inactiveFactor,
  });
  statusText.content = `Color: ${colors[colorIndex]} | Style: ${style} | Inactive: ${(inactiveFactor * 100).toFixed(0)}%`;
}

// Keyboard controls
renderer.keyInput.on("keypress", (key: KeyEvent) => {
  switch (key.raw) {
    case "c":
      // Cycle color
      colorIndex = (colorIndex + 1) % colors.length;
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
    case "q":
    case "\u0003": // Ctrl+C
      renderer.destroy();
      break;
  }
});
