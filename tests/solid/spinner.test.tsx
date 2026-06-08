import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { testRender } from "@opentui/solid";
import { getComponentCatalogue } from "@opentui/solid/components";
import { createSignal } from "solid-js";
import { SpinnerRenderable } from "../../src/index";
import { registerSpinner } from "../../src/solid";

let setup: Awaited<ReturnType<typeof testRender>> | undefined;
let originalSetInterval: typeof globalThis.setInterval;
let originalClearInterval: typeof globalThis.clearInterval;

beforeEach(() => {
  originalSetInterval = globalThis.setInterval;
  originalClearInterval = globalThis.clearInterval;
  globalThis.setInterval = (() =>
    1 as unknown as ReturnType<
      typeof setInterval
    >) as typeof globalThis.setInterval;
  globalThis.clearInterval = (() =>
    undefined) as typeof globalThis.clearInterval;
});

afterEach(() => {
  setup?.renderer.destroy();
  setup = undefined;
  globalThis.setInterval = originalSetInterval;
  globalThis.clearInterval = originalClearInterval;
});

describe("opentui-spinner/solid", () => {
  it("registers the spinner component in the Solid catalogue", () => {
    const catalogue = getComponentCatalogue();
    const hadPrevious = Object.hasOwn(catalogue, "spinner");
    const previous = catalogue.spinner;

    try {
      delete catalogue.spinner;
      registerSpinner();
      expect(catalogue.spinner).toBe(SpinnerRenderable);
    } finally {
      if (hadPrevious) {
        if (previous) catalogue.spinner = previous;
      } else {
        delete catalogue.spinner;
      }
    }
  });

  it("renders, reactively updates props, toggles autoplay, and destroys the renderable", async () => {
    let spinner: SpinnerRenderable | undefined;
    const [color, setColor] = createSignal("red");
    const [frames, setFrames] = createSignal(["A"]);
    const [autoplay, setAutoplay] = createSignal(false);

    setup = await testRender(
      () => (
        <spinner
          ref={(value: SpinnerRenderable) => {
            spinner = value;
          }}
          color={color()}
          frames={frames()}
          autoplay={autoplay()}
        />
      ),
      { width: 10, height: 2 },
    );
    await setup.renderOnce();

    expect(setup.captureCharFrame()).toContain("A");
    expect(spinner?.color).toBe("red");
    expect(spinner?.autoplay).toBe(false);
    expect(spinner?.isDestroyed).toBe(false);

    setColor("blue");
    setFrames(["B"]);
    setAutoplay(true);
    await setup.renderOnce();

    expect(setup.captureCharFrame()).toContain("B");
    expect(spinner?.color).toBe("blue");
    expect(spinner?.frames).toEqual(["B"]);
    expect(spinner?.autoplay).toBe(true);

    const renderedSpinner = spinner;
    setup.renderer.destroy();
    expect(renderedSpinner?.isDestroyed).toBe(true);
    setup = undefined;
  });
});
