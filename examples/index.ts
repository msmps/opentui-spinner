import {
  BoxRenderable,
  createCliRenderer,
  type KeyEvent,
  TextRenderable,
} from "@opentui/core";
import { SpinnerRenderable } from "../src/index";

const renderer = await createCliRenderer({ exitOnCtrlC: false });

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

renderer.keyInput.on("keypress", (key: KeyEvent) => {
  switch (key.raw) {
    case "\u0003":
      clearInterval(interval);
      renderer.destroy();
      break;
  }
});
