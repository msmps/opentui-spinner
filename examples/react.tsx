import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { useEffect, useState } from "react";

import "opentui-spinner/react";

const loadingSteps = [
  "Initializing...",
  "Loading dependencies...",
  "Loading configuration...",
  "Loading data...",
  "Processing data...",
  "Done!",
];

function App() {
  const [step, setCurrentStep] = useState<number>(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % loadingSteps.length);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <box alignItems="center" flexDirection="row">
      <spinner name="bouncingBall" />
      <text> {loadingSteps[step]}</text>
    </box>
  );
}

const renderer = await createCliRenderer();
createRoot(renderer).render(<App />);
