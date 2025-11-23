import { render } from "@opentui/solid";
import { createSignal, onCleanup } from "solid-js";

import "opentui-spinner/solid";

const loadingSteps = [
  "Initializing...",
  "Loading dependencies...",
  "Loading configuration...",
  "Loading data...",
  "Processing data...",
  "Done!",
];

function App() {
  const [step, setCurrentStep] = createSignal<number>(0);

  const interval = setInterval(() => {
    setCurrentStep((prev) => (prev + 1) % loadingSteps.length);
  }, 1000);

  onCleanup(() => clearInterval(interval));

  return (
    <box alignItems="center" flexDirection="row">
      <spinner name="bouncingBall" color="cyan" />
      <text marginLeft={1}> {loadingSteps[step()]}</text>
    </box>
  );
}

render(() => <App />);
