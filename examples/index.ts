import {
  BoxRenderable,
  CliRenderEvents,
  createCliRenderer,
  TextRenderable,
} from "@opentui/core";
import { SpinnerRenderable } from "../src/index";

const renderer = await createCliRenderer();

const container = new BoxRenderable(renderer, {
  border: true,
  flexDirection: "row",
  alignItems: "center",
});
renderer.root.add(container);

const label = new TextRenderable(renderer, {
  content: "Loading...",
  marginLeft: 1,
});

const spinner = new SpinnerRenderable(renderer, {
  name: "bouncingBall",
});

container.add(spinner);
container.add(label);

const loadingSteps = [
  "Initializing...",
  "Loading dependencies...",
  "Loading configuration...",
  "Loading data...",
  "Processing data...",
  "Done!",
];

let step = 0;
const interval = setInterval(() => {
  label.content = loadingSteps[step];
  step = (step + 1) % loadingSteps.length;
}, 1000);

renderer.once(CliRenderEvents.DESTROY, () => clearInterval(interval));
