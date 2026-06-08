import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import type { RenderLib } from "@opentui/core";
import { getComponentCatalogue } from "@opentui/react";
import { testRender } from "@opentui/react/test-utils";
import { act, useState } from "react";
import { SpinnerRenderable } from "../../src/index";
import { registerSpinner } from "../../src/react";

let setup: Awaited<ReturnType<typeof testRender>> | undefined;
let originalSetInterval: typeof globalThis.setInterval;
let originalClearInterval: typeof globalThis.clearInterval;
let intervalCallbacks: Array<() => void>;
let clearedIntervals: ReturnType<typeof setInterval>[];

beforeEach(() => {
  originalSetInterval = globalThis.setInterval;
  originalClearInterval = globalThis.clearInterval;
  intervalCallbacks = [];
  clearedIntervals = [];
  globalThis.setInterval = ((callback: () => void) => {
    intervalCallbacks.push(callback);
    return intervalCallbacks.length as unknown as ReturnType<
      typeof setInterval
    >;
  }) as typeof globalThis.setInterval;
  globalThis.clearInterval = ((handle: ReturnType<typeof setInterval>) => {
    clearedIntervals.push(handle);
  }) as typeof globalThis.clearInterval;
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
    const initialSpinner = spinner;

    act(() => update("blue", ["B"], true));
    await setup.renderOnce();

    expect(setup.captureCharFrame()).toContain("B");
    expect(spinner?.color).toBe("blue");
    expect(spinner?.frames).toEqual(["B"]);
    expect(spinner?.autoplay).toBe(true);
    expect(spinner).toBe(initialSpinner);
    expect(initialSpinner?.isDestroyed).toBe(false);

    const renderedSpinner = spinner;
    act(() => setup?.renderer.destroy());
    expect(renderedSpinner?.isDestroyed).toBe(true);
    setup = undefined;
  });

  it("preserves one instance and animation position for equivalent frame arrays", async () => {
    let spinner: SpinnerRenderable | null | undefined;
    let setFrames!: (frames: string[]) => void;

    function App() {
      const [frames, updateFrames] = useState(["A", "B"]);
      setFrames = updateFrames;
      return (
        <spinner
          ref={(value) => {
            spinner = value;
          }}
          frames={frames}
          autoplay
        />
      );
    }

    setup = await testRender(<App />, { width: 10, height: 2 });
    await setup.renderOnce();
    const initialSpinner = spinner;
    const lib = (initialSpinner as unknown as { _lib: RenderLib })._lib;
    const encodeUnicode = spyOn(lib, "encodeUnicode");
    const freeUnicode = spyOn(lib, "freeUnicode");
    const intervalCount = intervalCallbacks.length;
    const clearCount = clearedIntervals.length;

    intervalCallbacks.at(-1)?.();
    await setup.renderOnce();
    expect(setup.captureCharFrame()).toContain("B");

    act(() => setFrames(["A", "B"]));
    expect(encodeUnicode).not.toHaveBeenCalled();
    expect(freeUnicode).not.toHaveBeenCalled();
    expect(intervalCallbacks).toHaveLength(intervalCount);
    expect(clearedIntervals).toHaveLength(clearCount);
    encodeUnicode.mockRestore();
    freeUnicode.mockRestore();
    await setup.renderOnce();

    expect(spinner).toBe(initialSpinner);
    expect(initialSpinner?.isDestroyed).toBe(false);
    expect(initialSpinner?.frames).toEqual(["A", "B"]);
    expect(setup.captureCharFrame()).toContain("B");
  });
});
