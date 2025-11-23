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

const frames = [
  "▣⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝",
  "⬝▣⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝",
  "⬝⬝▣⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝",
  "⬝⬝⬝▣⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝",
  "⬝⬝⬝⬝▣⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝",
  "⬝⬝⬝⬝⬝▣⬝⬝⬝⬝⬝⬝⬝⬝⬝",
  "⬝⬝⬝⬝⬝⬝▣⬝⬝⬝⬝⬝⬝⬝⬝",
  "⬝⬝⬝⬝⬝⬝⬝▣⬝⬝⬝⬝⬝⬝⬝",
  "⬝⬝⬝⬝⬝⬝⬝⬝▣⬝⬝⬝⬝⬝⬝",
  "⬝⬝⬝⬝⬝⬝⬝⬝⬝▣⬝⬝⬝⬝⬝",
  "⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝▣⬝⬝⬝⬝",
  "⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝▣⬝⬝⬝",
  "⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝▣⬝⬝",
  "⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝▣⬝",
  "⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝▣",
  "⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝▣",
  "⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝▣",
  "⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝▣",
  "⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝▣",
  "⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝▣",
  "⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝▣⬝",
  "⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝▣⬝⬝",
  "⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝▣⬝⬝⬝",
  "⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝▣⬝⬝⬝⬝",
  "⬝⬝⬝⬝⬝⬝⬝⬝⬝▣⬝⬝⬝⬝⬝",
  "⬝⬝⬝⬝⬝⬝⬝⬝▣⬝⬝⬝⬝⬝⬝",
  "⬝⬝⬝⬝⬝⬝⬝▣⬝⬝⬝⬝⬝⬝⬝",
  "⬝⬝⬝⬝⬝⬝▣⬝⬝⬝⬝⬝⬝⬝⬝",
  "⬝⬝⬝⬝⬝▣⬝⬝⬝⬝⬝⬝⬝⬝⬝",
  "⬝⬝⬝⬝▣⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝",
  "⬝⬝⬝▣⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝",
  "⬝⬝▣⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝",
  "⬝▣⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝",
  "▣⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝",
  "▣⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝",
  "▣⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝",
  "▣⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝",
  "▣⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝⬝",
];

// Color gradient for the comet trail effect
// Brightest to darkest: #f5a742 → #ec8b0d → #b16809 → #764506 → #593405

const spinner = new SpinnerRenderable(renderer, {
  frames,
  interval: 80,
  color: createGradientTrail({
    colors: ["#f5a742", "#ec8b0d", "#b16809", "#764506", "#593405"],
    trailLength: 5,
    defaultColor: "#323232",
    direction: "bidirectional",
    holdFrames: { start: 4, end: 5 },
  }),
});

container.add(spinner);
