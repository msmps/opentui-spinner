import { BoxRenderable, createCliRenderer, engine } from "@opentui/core";
import { SpinnerRenderable } from "../../src/index";
import { createColors, createFrames } from "./utils";

const renderer = await createCliRenderer();
renderer.setBackgroundColor("#000000");
engine.attach(renderer);

const container = new BoxRenderable(renderer, {
  paddingTop: 2,
  paddingLeft: 4,
});
renderer.root.add(container);

const spinner = new SpinnerRenderable(renderer, {
  frames: createFrames({ style: "blocks" }),
  interval: 40,
  color: createColors({ style: "blocks" }),
});

container.add(spinner);
