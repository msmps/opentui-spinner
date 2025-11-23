import {
  type ColorInput,
  type LayoutOptions,
  type OptimizedBuffer,
  parseColor,
  Renderable,
  type RenderableOptions,
  type RenderContext,
  type RenderLib,
  resolveRenderLib,
} from "@opentui/core";

import spinners from "cli-spinners";
import type { ColorGenerator } from "./utils";

type SpinnerName = keyof typeof spinners;

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
  private _color: ColorInput | ColorGenerator;

  // Internals
  private _currentFrameIndex: number = 0;
  private _encodedFrames: Record<
    string,
    ReturnType<typeof OptimizedBuffer.prototype.encodeUnicode>
  > = {};

  private _lib: RenderLib = resolveRenderLib();
  private _intervalId: NodeJS.Timeout | null = null;

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
    this._frames = this._name
      ? spinners[this._name].frames
      : (options.frames ?? this._defaultOptions.frames);
    this._interval = this._name
      ? spinners[this._name].interval
      : (options.interval ?? this._defaultOptions.interval);
    this._autoplay = options.autoplay ?? this._defaultOptions.autoplay;
    this._backgroundColor =
      options.backgroundColor ?? this._defaultOptions.backgroundColor;
    this._color = options.color ?? this._defaultOptions.color;

    // Calculate max frame width and set dimensions
    const maxFrameWidth = Math.max(...this._frames.map((f) => f.length));
    this.width = maxFrameWidth;
    this.height = 1;

    // Pre-encode frames
    this._encodeFrames();

    if (this._autoplay) {
      this.start();
    }
  }

  private _encodeFrames(): void {
    for (const frame of this._frames) {
      const encoded = this._lib.encodeUnicode(frame, this.ctx.widthMethod);
      if (encoded) {
        this._encodedFrames[frame] = encoded;
      }
    }
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
    this.stop();
    this._interval = value;
    this.start();
  }

  public get name(): SpinnerName | undefined {
    return this._name;
  }

  public set name(value: SpinnerName | undefined) {
    this._freeFrames();
    this._name = value;
    this._frames = this._name
      ? spinners[this._name].frames
      : this._defaultOptions.frames;
    this._interval = this._name
      ? spinners[this._name].interval
      : this._defaultOptions.interval;

    // Update width based on new frames
    const maxFrameWidth = Math.max(...this._frames.map((f) => f.length));
    this.width = maxFrameWidth;
    this._encodeFrames();
    this.requestRender();
  }

  public get frames(): string[] {
    return this._frames;
  }

  public set frames(value: string[]) {
    this._freeFrames();
    this._frames = value.length === 0 ? this._defaultOptions.frames : value;
    this._encodeFrames();

    // Update width based on new frames
    const maxFrameWidth = Math.max(...this._frames.map((f) => f.length));
    this.width = maxFrameWidth;

    this.requestRender();
  }

  public get color(): ColorInput | ColorGenerator {
    return this._color;
  }

  public set color(value: ColorInput | ColorGenerator) {
    this._color = value;
    this.requestRender();
  }

  public get backgroundColor(): ColorInput {
    return this._backgroundColor;
  }

  public set backgroundColor(value: ColorInput) {
    this._backgroundColor = value;
    this.requestRender();
  }

  public start(): void {
    this._intervalId = setInterval(() => {
      this._currentFrameIndex =
        (this._currentFrameIndex + 1) % this._frames.length;
      this.requestRender();
    }, this._interval);
  }

  public stop(): void {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
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
          ? this._color(
              this._currentFrameIndex,
              i,
              this._frames.length,
              encodedFrame.data.length,
            )
          : this._color;

      buffer.drawChar(
        encodedFrame.data[i].char,
        x,
        this.y,
        parseColor(color),
        parseColor(this._backgroundColor),
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
