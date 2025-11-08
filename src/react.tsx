import { extend } from "@opentui/react";
import { SpinnerRenderable } from ".";

// Add TypeScript support
declare module "@opentui/react" {
  interface OpenTUIComponents {
    spinner: typeof SpinnerRenderable;
  }
}

// Register the component
extend({ spinner: SpinnerRenderable });
