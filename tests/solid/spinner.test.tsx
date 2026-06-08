import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import type { RenderLib } from "@opentui/core";
import { testRender } from "@opentui/solid";
import { getComponentCatalogue } from "@opentui/solid/components";
import { createSignal } from "solid-js";
import { SpinnerRenderable } from "../../src/index";
import { setSpinnerSchedulerClockForTesting } from "../../src/scheduler";
import { registerSpinner } from "../../src/solid";
import { FakeSchedulerClock } from "../core/fake-scheduler-clock";

let setup: Awaited<ReturnType<typeof testRender>> | undefined;
let clock: FakeSchedulerClock;

beforeEach(() => {
  clock = new FakeSchedulerClock();
  setSpinnerSchedulerClockForTesting(clock);
});

afterEach(() => {
  setup?.renderer.destroy();
  setup = undefined;
  setSpinnerSchedulerClockForTesting(undefined);
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
    const initialSpinner = spinner;

    setColor("blue");
    setFrames(["B"]);
    setAutoplay(true);
    await setup.renderOnce();

    expect(setup.captureCharFrame()).toContain("B");
    expect(spinner?.color).toBe("blue");
    expect(spinner?.frames).toEqual(["B"]);
    expect(spinner?.autoplay).toBe(true);
    expect(spinner).toBe(initialSpinner);
    expect(initialSpinner?.isDestroyed).toBe(false);

    const renderedSpinner = spinner;
    setup.renderer.destroy();
    expect(renderedSpinner?.isDestroyed).toBe(true);
    setup = undefined;
  });

  it("preserves one instance and animation position for equivalent frame arrays", async () => {
    let spinner: SpinnerRenderable | undefined;
    const [frames, setFrames] = createSignal(["A", "B"]);

    setup = await testRender(
      () => (
        <spinner
          ref={(value: SpinnerRenderable) => {
            spinner = value;
          }}
          frames={frames()}
          autoplay
        />
      ),
      { width: 10, height: 2 },
    );
    await setup.renderOnce();
    const initialSpinner = spinner;
    const lib = (initialSpinner as unknown as { _lib: RenderLib })._lib;
    const encodeUnicode = spyOn(lib, "encodeUnicode");
    const freeUnicode = spyOn(lib, "freeUnicode");
    const intervalCount = clock.callbacks.length;
    const clearCount = clock.cleared.length;

    clock.advance(initialSpinner?.interval ?? 0);
    await setup.renderOnce();
    expect(setup.captureCharFrame()).toContain("B");

    setFrames(["A", "B"]);
    expect(encodeUnicode).not.toHaveBeenCalled();
    expect(freeUnicode).not.toHaveBeenCalled();
    expect(clock.callbacks).toHaveLength(intervalCount + 1);
    expect(clock.cleared).toHaveLength(clearCount + 1);
    encodeUnicode.mockRestore();
    freeUnicode.mockRestore();
    await setup.renderOnce();

    expect(spinner).toBe(initialSpinner);
    expect(initialSpinner?.isDestroyed).toBe(false);
    expect(initialSpinner?.frames).toEqual(["A", "B"]);
    expect(setup.captureCharFrame()).toContain("B");
  });
});
