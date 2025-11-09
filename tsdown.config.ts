import { defineConfig } from "tsdown";

export default defineConfig({
  dts: true,
  entry: ["./src/index.ts", "./src/react.ts", "./src/solid.ts"],
  external: ["@opentui/core", "@opentui/react", "@opentui/solid"],
  format: ["esm"],
  minify: true,
});
