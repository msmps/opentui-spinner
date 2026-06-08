import { extend } from "@opentui/solid/components";
import { SpinnerRenderable } from "./index";

// Add TypeScript support
declare module "@opentui/solid" {
  interface OpenTUIComponents {
    spinner: typeof SpinnerRenderable;
  }
}

// Register the component
export function registerSpinner(): void {
  extend({ spinner: SpinnerRenderable });
}

registerSpinner();
