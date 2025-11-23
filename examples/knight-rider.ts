import { BoxRenderable, createCliRenderer, engine } from "@opentui/core";
import { createGradientTrail, SpinnerRenderable } from "../src/index";

const renderer = await createCliRenderer();
renderer.setBackgroundColor("#000000");
engine.attach(renderer);

const container = new BoxRenderable(renderer, {
  paddingTop: 2,
  paddingLeft: 4,
});
renderer.root.add(container);

// Configuration for the Knight Rider scanner
const width = 10;
const char = "■"; // Block character simulating an LED segment
const pattern = char.repeat(width);

// Cycle definition
const holdStart = 25;
const holdEnd = 0;
// Bidirectional cycle: Forward (width) + Hold End + Backward (width-1) + Hold Start
const totalFrames = width + holdEnd + (width - 1) + holdStart;

// For this effect, the characters themselves don't move, only their colors change.
// So we repeat the same static pattern for every frame.
const frames = Array(totalFrames).fill(pattern);

const spinner = new SpinnerRenderable(renderer, {
  frames,
  interval: 40, // Slightly slower for "burst" effect
  color: createGradientTrail({
    colors: [
      "#ff0000", // Brightest Red (Center)
      "#ff3333", // Glare/Bloom
      "#cc0000", // Trail 1
      "#990000", // Trail 2
      "#660000", // Trail 3
      "#330000", // Trail 4
    ],
    trailLength: 6,
    defaultColor: "#1a1a1a", // Unlit segments (dark gray)
    direction: "bidirectional",
    holdFrames: { start: holdStart, end: holdEnd },
  }),
});

container.add(spinner);
