import {
  type ColorInput,
  type LayoutOptions,
  type OptimizedBuffer,
  parseColor,
  Renderable,
  type RenderableOptions,
  type RenderContext,
  type RenderLib,
  type RGBA,
  resolveRenderLib,
} from "@opentui/core";

import spinners from "cli-spinners";
import { spinnerScheduler, validateSpinnerInterval } from "./scheduler";
import type { ColorGenerator } from "./utils";

type SpinnerName = keyof typeof spinners;

function framesEqual(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((frame, index) => frame === right[index])
  );
}

export interface SpinnerOptions
  extends Omit<
    RenderableOptions<SpinnerRenderable>,
    "width" | "height" | "buffered" | "live" | keyof LayoutOptions
  > {
  name?: SpinnerName;
  frames?: string[];
  interval?: number;
  autoplay?: boolean;
  backgroundColor?: ColorInput;
  color?: ColorInput | ColorGenerator;
}

export class SpinnerRenderable extends Renderable {
  // Configurable properties
  private _name: SpinnerName | undefined;
  private _frames: string[];
  private _interval: number;
  private _autoplay: boolean;
  private _backgroundColor: ColorInput;
  private _parsedBackgroundColor: RGBA;
  private _color: ColorInput | ColorGenerator;
  private _parsedColor: RGBA;

  // Internals
  private _currentFrameIndex: number = 0;
  private _encodedFrames: Record<
    string,
    ReturnType<typeof OptimizedBuffer.prototype.encodeUnicode>
  > = {};

  private _lib: RenderLib = resolveRenderLib();
  private _isRunning = false;
  private readonly _advanceFrame = (): void => {
    if (!this._isRunning || this.isDestroyed) return;

    this._currentFrameIndex =
      (this._currentFrameIndex + 1) % this._frames.length;
    this.requestRender();
  };

  protected _defaultOptions = {
    name: "dots",
    frames: spinners.dots.frames,
    interval: spinners.dots.interval,
    autoplay: true,
    backgroundColor: "transparent",
    color: "white",
  } satisfies SpinnerOptions;

  constructor(ctx: RenderContext, options: SpinnerOptions) {
    super(ctx, options);

    this._name = options.name;
    this._frames = options.frames?.length
      ? options.frames
      : this._name
        ? spinners[this._name].frames
        : this._defaultOptions.frames;
    this._interval = validateSpinnerInterval(
      options.interval ??
        (this._name
          ? spinners[this._name].interval
          : this._defaultOptions.interval),
    );
    this._autoplay = options.autoplay ?? this._defaultOptions.autoplay;
    this._backgroundColor =
      options.backgroundColor ?? this._defaultOptions.backgroundColor;
    this._parsedBackgroundColor = parseColor(this._backgroundColor);
    this._color = options.color ?? this._defaultOptions.color;
    this._parsedColor =
      typeof this._color === "function"
        ? parseColor(this._defaultOptions.color)
        : parseColor(this._color);

    this.height = 1;

    // Pre-encode frames
    this._encodeFrames();

    if (this._autoplay) {
      this.start();
    }
  }

  private _encodeFrames(): void {
    let maxFrameWidth = 0;

    for (const frame of this._frames) {
      if (this._encodedFrames[frame]) continue;

      const encoded = this._lib.encodeUnicode(frame, this.ctx.widthMethod);
      if (encoded) {
        this._encodedFrames[frame] = encoded;
        maxFrameWidth = Math.max(
          maxFrameWidth,
          encoded.data.reduce((width, char) => width + char.width, 0),
        );
      }
    }

    this.width = maxFrameWidth;
  }

  private _freeFrames(): void {
    for (const frame in this._encodedFrames) {
      if (this._encodedFrames[frame]) {
        this._lib.freeUnicode(this._encodedFrames[frame]);
      }
    }
    this._encodedFrames = {};
  }

  public get interval(): number {
    return this._interval;
  }

  public set interval(value: number) {
    this._interval = validateSpinnerInterval(value);
    if (this._isRunning) {
      spinnerScheduler.reschedule(this, this._interval);
    }
  }

  public get name(): SpinnerName | undefined {
    return this._name;
  }

  public set name(value: SpinnerName | undefined) {
    const frames = value ? spinners[value].frames : this._defaultOptions.frames;
    const interval = validateSpinnerInterval(
      value ? spinners[value].interval : this._defaultOptions.interval,
    );
    const framesChanged = !framesEqual(this._frames, frames);
    const intervalChanged = this._interval !== interval;
    this._name = value;
    this._interval = interval;

    if (framesChanged) {
      this._freeFrames();
      this._frames = frames;
      this._currentFrameIndex = 0;
      this._encodeFrames();
      if (this.visible) this.requestRender();
    }

    if (this._isRunning && intervalChanged) {
      spinnerScheduler.reschedule(this, interval);
    }
  }

  public get frames(): string[] {
    return this._frames;
  }

  public set frames(value: string[]) {
    const frames = value.length === 0 ? this._defaultOptions.frames : value;
    if (framesEqual(this._frames, frames)) {
      this._frames = frames;
      return;
    }

    this._freeFrames();
    this._frames = frames;
    this._currentFrameIndex = 0;
    this._encodeFrames();

    if (this.visible) this.requestRender();
  }

  public get color(): ColorInput | ColorGenerator {
    return this._color;
  }

  public set color(value: ColorInput | ColorGenerator) {
    this._color = value;
    if (typeof value !== "function") this._parsedColor = parseColor(value);
    if (this.visible) this.requestRender();
  }

  public get backgroundColor(): ColorInput {
    return this._backgroundColor;
  }

  public set backgroundColor(value: ColorInput) {
    this._backgroundColor = value;
    this._parsedBackgroundColor = parseColor(value);
    if (this.visible) this.requestRender();
  }

  public override get visible(): boolean {
    return super.visible;
  }

  public override set visible(value: boolean) {
    if (value === super.visible) return;

    super.visible = value;
    if (!this._isRunning) return;

    if (value) {
      spinnerScheduler.start(this, this._interval, this._advanceFrame);
    } else {
      spinnerScheduler.stop(this);
    }
  }

  public get autoplay(): boolean {
    return this._autoplay;
  }

  public set autoplay(value: boolean) {
    this._autoplay = value;
    if (value) {
      this.start();
    } else {
      this.stop();
    }
  }

  public start(): void {
    if (this._isRunning || this.isDestroyed) return;

    this._isRunning = true;
    if (this.visible) {
      spinnerScheduler.start(this, this._interval, this._advanceFrame);
    }
  }

  public stop(): void {
    if (!this._isRunning) return;

    this._isRunning = false;
    spinnerScheduler.stop(this);
  }

  protected override renderSelf(buffer: OptimizedBuffer): void {
    if (!this.visible) return;

    const currentFrame = this._frames[this._currentFrameIndex];
    if (!currentFrame) return;

    const encodedFrame = this._encodedFrames[currentFrame];
    if (!encodedFrame) return;

    let x = this.x;
    for (let i = 0; i < encodedFrame.data.length; i++) {
      const color =
        typeof this._color === "function"
          ? parseColor(
              this._color(
                this._currentFrameIndex,
                i,
                this._frames.length,
                encodedFrame.data.length,
              ),
            )
          : this._parsedColor;

      buffer.drawChar(
        encodedFrame.data[i].char,
        x,
        this.y,
        color,
        this._parsedBackgroundColor,
      );
      x += encodedFrame.data[i].width;
    }
  }

  protected override destroySelf(): void {
    this.stop();
    this._freeFrames();
    super.destroySelf();
  }
}

export * from "./utils";
