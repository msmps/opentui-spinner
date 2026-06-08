import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { getComponentCatalogue } from "@opentui/react";
import { testRender } from "@opentui/react/test-utils";
import { act, useState } from "react";
import { SpinnerRenderable } from "../../src/index";
import { registerSpinner } from "../../src/react";

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
  act(() => setup?.renderer.destroy());
  setup = undefined;
  globalThis.setInterval = originalSetInterval;
  globalThis.clearInterval = originalClearInterval;
});

describe("opentui-spinner/react", () => {
  it("registers the spinner component in the React catalogue", () => {
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

  it("renders, updates props, toggles autoplay, and destroys the renderable", async () => {
    let spinner: SpinnerRenderable | null | undefined;
    let update!: (color: string, frames: string[], autoplay: boolean) => void;

    function App() {
      const [props, setProps] = useState({
        color: "red",
        frames: ["A"],
        autoplay: false,
      });
      update = (color, frames, autoplay) =>
        setProps({ color, frames, autoplay });

      return (
        <spinner
          ref={(value) => {
            spinner = value;
          }}
          color={props.color}
          frames={props.frames}
          autoplay={props.autoplay}
        />
      );
    }

    setup = await testRender(<App />, { width: 10, height: 2 });
    await setup.renderOnce();

    expect(setup.captureCharFrame()).toContain("A");
    expect(spinner?.color).toBe("red");
    expect(spinner?.autoplay).toBe(false);
    expect(spinner?.isDestroyed).toBe(false);

    act(() => update("blue", ["B"], true));
    await setup.renderOnce();

    expect(setup.captureCharFrame()).toContain("B");
    expect(spinner?.color).toBe("blue");
    expect(spinner?.frames).toEqual(["B"]);
    expect(spinner?.autoplay).toBe(true);

    const renderedSpinner = spinner;
    act(() => setup?.renderer.destroy());
    expect(renderedSpinner?.isDestroyed).toBe(true);
    setup = undefined;
  });
});
