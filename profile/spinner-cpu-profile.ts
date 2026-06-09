import { CliRenderEvents } from "@opentui/core";
import { createTestRenderer } from "@opentui/core/testing";
import { SpinnerRenderable } from "../src/index";

interface ProfileArgs {
  count: number;
  durationMs: number;
  interval: number;
  mode: "aligned" | "staggered" | "mixed";
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function nonNegativeInteger(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseArgs(argv: string[]): ProfileArgs {
  const values = new Map(
    argv.map((arg) => {
      const [key, value] = arg.replace(/^--/, "").split("=", 2);
      return [key, value];
    }),
  );
  const mode = values.get("mode") ?? "aligned";
  if (mode !== "aligned" && mode !== "staggered" && mode !== "mixed") {
    throw new Error(`Invalid mode: ${mode}`);
  }
  return {
    count: nonNegativeInteger(values.get("count"), 10),
    durationMs: positiveInteger(values.get("duration-ms"), 15_000),
    interval: positiveInteger(values.get("interval"), 80),
    mode,
  };
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

const args = parseArgs(process.argv.slice(2));
const setup = await createTestRenderer({
  width: Math.max(20, Math.min(args.count, 200)),
  height: Math.max(4, Math.ceil(args.count / 200)),
  maxFps: 60,
});
const { renderer } = setup;
const spinners: SpinnerRenderable[] = [];
let renderRequests = 0;
let renderedFrames = 0;

renderer.on(CliRenderEvents.FRAME, () => renderedFrames++);

for (let index = 0; index < args.count; index++) {
  const interval =
    args.mode === "mixed" ? [40, 80, 120, 200, 400][index % 5] : args.interval;
  const spinner = new SpinnerRenderable(renderer, {
    frames: ["-", "\\", "|", "/"],
    interval,
    autoplay: false,
  });
  spinner.position = "absolute";
  spinner.left = index % 200;
  spinner.top = Math.floor(index / 200);
  const requestRender = spinner.requestRender.bind(spinner);
  spinner.requestRender = () => {
    renderRequests++;
    requestRender();
  };
  renderer.root.add(spinner);
  spinner.start();
  spinners.push(spinner);

  if (args.mode === "staggered") {
    await sleep(Math.max(1, Math.floor(args.interval / args.count)));
  }
}

await renderer.idle();
renderRequests = 0;
renderedFrames = 0;

const startFrameId = renderer.frameId;
const startCpu = process.cpuUsage();
const startWall = performance.now();
await sleep(args.durationMs);
await renderer.idle();
const wallMs = performance.now() - startWall;
const cpu = process.cpuUsage(startCpu);

for (const spinner of spinners) spinner.stop();
await renderer.idle();
const endFrameId = renderer.frameId;
renderer.destroy();

const cpuMs = (cpu.user + cpu.system) / 1_000;
const expectedMaxFrames = Math.ceil((wallMs / 1_000) * 60) + 1;
const result = {
  ...args,
  wallMs,
  cpuMs,
  userCpuMs: cpu.user / 1_000,
  systemCpuMs: cpu.system / 1_000,
  cpuPercentOfOneCore: (cpuMs / wallMs) * 100,
  renderRequests,
  renderedFrames,
  frameIdDelta: endFrameId - startFrameId,
  framesPerSecond: renderedFrames / (wallMs / 1_000),
  renderRequestsPerSecond: renderRequests / (wallMs / 1_000),
  requestsPerRenderedFrame:
    renderedFrames === 0 ? 0 : renderRequests / renderedFrames,
  expectedMaxFrames,
  stayedWithinMaxFps: renderedFrames <= expectedMaxFrames,
};

console.log(JSON.stringify(result, null, 2));
