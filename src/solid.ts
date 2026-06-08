import { extend } from "@opentui/solid";
import { SpinnerRenderable } from "./index";

// Add TypeScript support
declare module "@opentui/solid" {
  interface OpenTUIComponents {
    spinner: typeof SpinnerRenderable;
  }
}

// Register the component
extend({ spinner: SpinnerRenderable });
