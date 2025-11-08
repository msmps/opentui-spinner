import {
  type ColorInput,
  createTimeline,
  type LayoutOptions,
  type OptimizedBuffer,
  parseColor,
  Renderable,
  type RenderableOptions,
  type RenderContext,
  type Timeline,
} from "@opentui/core";

import spinners from "cli-spinners";

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
  loop?: boolean;
  backgroundColor?: ColorInput;
  color?: ColorInput;
}

export class SpinnerRenderable extends Renderable {
  private _name: SpinnerName | undefined;
  private _frames: string[];
  private _interval: number;
  private _currentFrameIndex: number = 0;
  private _backgroundColor: ColorInput;
  private _color: ColorInput;
  private _timeline: Timeline;

  protected _defaultOptions = {
    name: "dots",
    frames: spinners.dots.frames,
    interval: spinners.dots.interval,
    autoplay: true,
    loop: true,
    color: "white",
    backgroundColor: "transparent",
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

    this._color = options.color ?? this._defaultOptions.color;
    this._backgroundColor =
      options.backgroundColor ?? this._defaultOptions.backgroundColor;

    // Calculate max frame width and set dimensions
    const maxFrameWidth = Math.max(...this._frames.map((f) => f.length));
    this.width = maxFrameWidth;
    this.height = 1;

    const autoplay = options.autoplay ?? this._defaultOptions.autoplay;
    const loop = options.loop ?? this._defaultOptions.loop;

    this._timeline = createTimeline({
      loop,
      autoplay,
      duration: this._interval * this._frames.length,
    });

    this._timeline.add(
      {
        time: 0,
      },
      {
        time: this._interval * this._frames.length,
        duration: this._interval * this._frames.length,
        ease: "linear",
        onUpdate: (anim) => {
          const currentTime = anim.currentTime;
          const cycleDuration = this._interval * this._frames.length;

          // Use modulo to get time within current cycle (handles looping automatically)
          // Add a small epsilon to handle edge cases at cycle boundaries
          const cycleTime = (currentTime % cycleDuration) + 0.001;

          const expectedFrameIndex = Math.min(
            Math.floor(cycleTime / this._interval),
            this._frames.length - 1,
          );

          if (expectedFrameIndex !== this._currentFrameIndex) {
            this._currentFrameIndex = expectedFrameIndex;
            this.requestRender();
          }
        },
      },
      0,
    );
  }

  public get interval(): number {
    return this._interval;
  }

  public set interval(value: number) {
    this._interval = value;
    this._timeline.duration = this._interval * this._frames.length;
    this.requestRender();
  }

  public get name(): SpinnerName | undefined {
    return this._name;
  }

  public set name(value: SpinnerName | undefined) {
    this._name = value;
    this._frames = this._name
      ? spinners[this._name].frames
      : this._defaultOptions.frames;
    this._interval = this._name
      ? spinners[this._name].interval
      : this._defaultOptions.interval;
    this._timeline.duration = this._interval * this._frames.length;

    // Update width based on new frames
    const maxFrameWidth = Math.max(...this._frames.map((f) => f.length));
    this.width = maxFrameWidth;

    this.requestRender();
  }

  public get frames(): string[] {
    return this._frames;
  }

  public set frames(value: string[]) {
    this._frames = value.length === 0 ? this._defaultOptions.frames : value;
    this._timeline.duration = this._interval * this._frames.length;

    // Update width based on new frames
    const maxFrameWidth = Math.max(...this._frames.map((f) => f.length));
    this.width = maxFrameWidth;

    this.requestRender();
  }

  public get color(): ColorInput {
    return this._color;
  }

  public set color(value: ColorInput) {
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
    this._timeline.play();
  }

  public stop(): void {
    this._timeline.pause();
  }

  protected override renderSelf(buffer: OptimizedBuffer): void {
    if (!this.visible) return;

    const currentFrame = this._frames[this._currentFrameIndex];
    if (!currentFrame) return;

    // Center the current frame within the fixed width of the renderable
    const xOffset = Math.floor((this.width - currentFrame.length) / 2);
    buffer.drawText(
      currentFrame,
      this.x + xOffset,
      this.y,
      parseColor(this._color),
      parseColor(this._backgroundColor),
    );
  }

  protected override destroySelf(): void {
    this.stop();
    super.destroySelf();
  }
}
