import { extend } from "@opentui/react";
import { SpinnerRenderable } from "./index";

// Add TypeScript support
declare module "@opentui/react" {
  interface OpenTUIComponents {
    spinner: typeof SpinnerRenderable;
  }
}

// Register the component
export function registerSpinner(): void {
  extend({ spinner: SpinnerRenderable });
}

registerSpinner();
