import { BoxRenderable, createCliRenderer } from "@opentui/core";
import { SpinnerRenderable } from "../../src/index";
import { createColors, createFrames } from "./utils";

const renderer = await createCliRenderer();
renderer.setBackgroundColor("#000000");

const container = new BoxRenderable(renderer, {
  paddingTop: 2,
  paddingLeft: 4,
});
renderer.root.add(container);

const wrapper = new BoxRenderable(renderer, {
  width: "100%",
  height: "100%",
  alignItems: "center",
  justifyContent: "center",
});
container.add(wrapper);

const spinner = new SpinnerRenderable(renderer, {
  frames: createFrames({ style: "blocks" }),
  interval: 40,
  color: createColors({ style: "blocks" }),
});

wrapper.add(spinner);
