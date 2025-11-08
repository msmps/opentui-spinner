import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["./src/index.ts", "./src/react.tsx"],
  dts: true,
  format: ["esm"],
  external: ["@opentui/core", "@opentui/react"],
  minify: true,
});
