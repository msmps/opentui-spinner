import { BoxRenderable, createCliRenderer, engine } from "@opentui/core";
import { SpinnerRenderable, createFrames, createColors } from "../src/index";

const renderer = await createCliRenderer();
renderer.setBackgroundColor("#000000");
engine.attach(renderer);

const container = new BoxRenderable(renderer, {
  paddingTop: 2,
  paddingLeft: 4,
});
renderer.root.add(container);

const spinner = new SpinnerRenderable(renderer, {
  frames: createFrames({ style: "diamonds" }),
  interval: 40,
  color: createColors({ style: "diamonds" }),
});

container.add(spinner);
