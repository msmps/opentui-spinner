import { BoxRenderable, createCliRenderer } from "@opentui/core";
import { SpinnerRenderable } from "../../src/index";
import { createGradientTrail } from "./colors";

// Create renderer
const renderer = await createCliRenderer();
renderer.setBackgroundColor("#000000");

// Create container
const container = new BoxRenderable(renderer, {});
renderer.root.add(container);

const wrapper = new BoxRenderable(renderer, {
  width: "100%",
  height: "100%",
  alignItems: "center",
  justifyContent: "center",
});
container.add(wrapper);

// Create frames
const frames = [
  "▣■■■■■■■■■■■■■■",
  "■▣■■■■■■■■■■■■■",
  "■■▣■■■■■■■■■■■■",
  "■■■▣■■■■■■■■■■■",
  "■■■■▣■■■■■■■■■■",
  "■■■■■▣■■■■■■■■■",
  "■■■■■■▣■■■■■■■■",
  "■■■■■■■▣■■■■■■■",
  "■■■■■■■■▣■■■■■■",
  "■■■■■■■■■▣■■■■■",
  "■■■■■■■■■■▣■■■■",
  "■■■■■■■■■■■▣■■■",
  "■■■■■■■■■■■■▣■■",
  "■■■■■■■■■■■■■▣■",
  "■■■■■■■■■■■■■■▣",
  "■■■■■■■■■■■■■■▣",
  "■■■■■■■■■■■■■■▣",
  "■■■■■■■■■■■■■■▣",
  "■■■■■■■■■■■■■■▣",
  "■■■■■■■■■■■■■■▣",
  "■■■■■■■■■■■■■▣■",
  "■■■■■■■■■■■■▣■■",
  "■■■■■■■■■■■▣■■■",
  "■■■■■■■■■■▣■■■■",
  "■■■■■■■■■▣■■■■■",
  "■■■■■■■■▣■■■■■■",
  "■■■■■■■▣■■■■■■■",
  "■■■■■■▣■■■■■■■■",
  "■■■■■▣■■■■■■■■■",
  "■■■■▣■■■■■■■■■■",
  "■■■▣■■■■■■■■■■■",
  "■■▣■■■■■■■■■■■■",
  "■▣■■■■■■■■■■■■■",
  "▣■■■■■■■■■■■■■■",
  "▣■■■■■■■■■■■■■■",
  "▣■■■■■■■■■■■■■■",
  "▣■■■■■■■■■■■■■■",
  "▣■■■■■■■■■■■■■■",
];

// Color gradient for the trail effect
// Brightest to darkest: #f5a742 → #ec8b0d → #b16809 → #764506 → #593405

// Create spinner
const spinner = new SpinnerRenderable(renderer, {
  frames,
  interval: 80,
  color: createGradientTrail({
    colors: ["#f5a742", "#ec8b0d", "#b16809", "#764506", "#593405"],
    trailLength: 5,
    defaultColor: "#323232",
    holdFrames: 5,
  }),
});

// Add spinner to wrapper
wrapper.add(spinner);
