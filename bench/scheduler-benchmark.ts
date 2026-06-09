import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import path from "node:path";
import {
  MIN_SPINNER_INTERVAL,
  SpinnerScheduler,
  type SpinnerSchedulerClock,
} from "../src/scheduler";

const DEFAULT_ITERATIONS = 1_000;
const DEFAULT_WARMUP = 1_000;
const DEFAULT_ROUNDS = 7;
const DEFAULT_MIN_SAMPLE_MS = 500;
const BENCHMARK_VERSION = 1;

interface BenchmarkArgs {
  iterations: number;
  warmupIterations: number;
  rounds: number;
  minSampleMs: number;
  scenarioNames?: Set<string>;
  jsonPath?: string;
  listScenarios: boolean;
}

interface Timer {
  callback: () => void;
  dueAt: number;
}

class BenchmarkClock implements SpinnerSchedulerClock {
  public nowValue = 0;
  public maxActiveTimers = 0;
  public timersCreated = 0;
  public timersCleared = 0;

  private nextHandle = 1;
  private readonly timers = new Map<ReturnType<typeof setInterval>, Timer>();

  public now(): number {
    return this.nowValue;
  }

  public setInterval(
    callback: () => void,
    delay: number,
  ): ReturnType<typeof setInterval> {
    const handle = this.nextHandle++ as unknown as ReturnType<
      typeof setInterval
    >;
    this.timers.set(handle, { callback, dueAt: this.nowValue + delay });
    this.timersCreated++;
    this.maxActiveTimers = Math.max(this.maxActiveTimers, this.timers.size);
    return handle;
  }

  public clearInterval(handle: ReturnType<typeof setInterval>): void {
    if (this.timers.delete(handle)) this.timersCleared++;
  }

  public get activeTimers(): number {
    return this.timers.size;
  }

  public fireNext(): number {
    let earliest = Number.POSITIVE_INFINITY;
    for (const timer of this.timers.values()) {
      earliest = Math.min(earliest, timer.dueAt);
    }
    if (!Number.isFinite(earliest)) return 0;

    this.nowValue = earliest;
    const due = Array.from(this.timers.values()).filter(
      (timer) => timer.dueAt <= earliest,
    );
    for (const timer of due) timer.callback();
    return due.length;
  }
}

interface Scheduler {
  start(spinner: object, interval: number, advance: () => void): void;
  reschedule(spinner: object, interval: number): void;
  stop(spinner: object): void;
}

interface LinearRegistration {
  spinner: object;
  interval: number;
  nextDueAt: number;
  advance: () => void;
}

class LinearScheduler implements Scheduler {
  private readonly active = new Map<object, LinearRegistration>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private timerDueAt = 0;
  private generation = 0;
  private lastWakeAt = Number.NEGATIVE_INFINITY;

  public constructor(private readonly clock: BenchmarkClock) {}

  public start(spinner: object, interval: number, advance: () => void): void {
    if (this.active.has(spinner)) return;
    this.active.set(spinner, {
      spinner,
      interval,
      nextDueAt: this.clock.now() + interval,
      advance,
    });
    this.armNext();
  }

  public reschedule(spinner: object, interval: number): void {
    const current = this.active.get(spinner);
    if (!current) return;
    this.active.set(spinner, {
      spinner,
      interval,
      nextDueAt: this.clock.now() + interval,
      advance: current.advance,
    });
    this.armNext();
  }

  public stop(spinner: object): void {
    if (!this.active.delete(spinner)) return;
    this.armNext();
  }

  private earliestDeadline(): number | undefined {
    let earliest: number | undefined;
    for (const registration of this.active.values()) {
      if (earliest === undefined || registration.nextDueAt < earliest) {
        earliest = registration.nextDueAt;
      }
    }
    return earliest;
  }

  private armNext(): void {
    const earliest = this.earliestDeadline();
    if (earliest === undefined) {
      this.cancelTimer();
      this.lastWakeAt = Number.NEGATIVE_INFINITY;
      return;
    }

    const dueAt = Math.max(earliest, this.lastWakeAt + MIN_SPINNER_INTERVAL);
    if (this.timer !== null && this.timerDueAt === dueAt) return;

    this.cancelTimer();
    const generation = this.generation;
    this.timerDueAt = dueAt;
    this.timer = this.clock.setInterval(
      () => this.tick(generation),
      Math.max(dueAt - this.clock.now(), 0),
    );
  }

  private cancelTimer(): void {
    if (this.timer === null) return;
    this.generation++;
    this.clock.clearInterval(this.timer);
    this.timer = null;
  }

  private tick(generation: number): void {
    if (generation !== this.generation || this.timer === null) return;
    const timer = this.timer;
    this.generation++;
    this.timer = null;
    this.clock.clearInterval(timer);

    const now = this.clock.now();
    let advanced = false;
    for (const registration of Array.from(this.active.values())) {
      if (registration.nextDueAt > now) continue;
      registration.advance();
      advanced = true;
      if (this.active.get(registration.spinner) !== registration) continue;
      registration.nextDueAt = now + registration.interval;
    }
    if (advanced) this.lastWakeAt = now;
    this.armNext();
  }
}

class PerSpinnerScheduler implements Scheduler {
  private readonly active = new Map<
    object,
    {
      interval: number;
      advance: () => void;
      timer: ReturnType<typeof setInterval>;
    }
  >();

  public constructor(private readonly clock: BenchmarkClock) {}

  public start(spinner: object, interval: number, advance: () => void): void {
    if (this.active.has(spinner)) return;
    const timer = this.clock.setInterval(advance, interval);
    this.active.set(spinner, { interval, advance, timer });
  }

  public reschedule(spinner: object, interval: number): void {
    const current = this.active.get(spinner);
    if (!current) return;
    this.clock.clearInterval(current.timer);
    const timer = this.clock.setInterval(current.advance, interval);
    this.active.set(spinner, { interval, advance: current.advance, timer });
  }

  public stop(spinner: object): void {
    const current = this.active.get(spinner);
    if (!current) return;
    this.clock.clearInterval(current.timer);
    this.active.delete(spinner);
  }
}

type ImplementationName =
  | "adaptive-heap"
  | "heap-only"
  | "linear-scan"
  | "per-spinner";

interface ScenarioInstance {
  runIteration: (iteration: number) => number;
  cleanup: () => void;
  metrics: () => ScenarioMetrics;
}

interface ScenarioMetrics {
  advances: number;
  maxActiveTimers: number;
  timersCreated: number;
  timersCleared: number;
}

interface BenchmarkScenario {
  name: string;
  description: string;
  implementation: ImplementationName;
  size: number;
  setup: () => ScenarioInstance;
}

interface BenchmarkSample {
  round: number;
  iterations: number;
  durationMs: number;
  opsPerSecond: number;
  nsPerOperation: number;
}

interface BenchmarkResult {
  name: string;
  description: string;
  implementation: ImplementationName;
  size: number;
  batchIterations: number;
  medianNsPerOperation: number;
  p95NsPerOperation: number;
  medianOpsPerSecond: number;
  rmePercent: number;
  metrics: ScenarioMetrics;
  samples: BenchmarkSample[];
}

function makeScheduler(
  implementation: ImplementationName,
  clock: BenchmarkClock,
): Scheduler {
  if (implementation === "adaptive-heap") return new SpinnerScheduler(clock);
  if (implementation === "heap-only") {
    return new SpinnerScheduler(clock, Number.POSITIVE_INFINITY);
  }
  if (implementation === "linear-scan") return new LinearScheduler(clock);
  return new PerSpinnerScheduler(clock);
}

function createTickScenario(
  implementation: "adaptive-heap" | "heap-only" | "linear-scan",
  size: number,
  allDue: boolean,
): BenchmarkScenario {
  const suffix = allDue ? "all_due" : "sparse_due";
  return {
    name: `tick_${suffix}_${size}_${implementation}`,
    description: allDue
      ? `Process a wake where ${size} spinners are due`
      : `Process sparse wakes with one fast spinner among ${size - 1} slow spinners`,
    implementation,
    size,
    setup() {
      const clock = new BenchmarkClock();
      const scheduler = makeScheduler(implementation, clock);
      const spinners = Array.from({ length: size }, () => ({}));
      let advances = 0;
      for (let index = 0; index < spinners.length; index++) {
        scheduler.start(
          spinners[index],
          allDue || index === 0 ? 80 : 1_000,
          () => advances++,
        );
      }
      return {
        runIteration() {
          const before = advances;
          clock.fireNext();
          return advances - before;
        },
        cleanup() {
          for (const spinner of spinners) scheduler.stop(spinner);
        },
        metrics: () => ({
          advances,
          maxActiveTimers: clock.maxActiveTimers,
          timersCreated: clock.timersCreated,
          timersCleared: clock.timersCleared,
        }),
      };
    },
  };
}

function createRescheduleScenario(
  implementation: "adaptive-heap" | "linear-scan",
  size: number,
): BenchmarkScenario {
  return {
    name: `reschedule_${size}_${implementation}`,
    description: `Reschedule non-earliest spinners among ${size} active spinners`,
    implementation,
    size,
    setup() {
      const clock = new BenchmarkClock();
      const scheduler = makeScheduler(implementation, clock);
      const spinners = Array.from({ length: size }, () => ({}));
      let advances = 0;
      for (let index = 0; index < spinners.length; index++) {
        scheduler.start(
          spinners[index],
          index === 0 ? 80 : 1_000,
          () => advances++,
        );
      }
      return {
        runIteration(iteration) {
          const index = 1 + (iteration % Math.max(1, size - 1));
          scheduler.reschedule(spinners[index], 900 + (iteration % 101));
          return index;
        },
        cleanup() {
          for (const spinner of spinners) scheduler.stop(spinner);
        },
        metrics: () => ({
          advances,
          maxActiveTimers: clock.maxActiveTimers,
          timersCreated: clock.timersCreated,
          timersCleared: clock.timersCleared,
        }),
      };
    },
  };
}

function createLifecycleScenario(
  implementation: ImplementationName,
  size: number,
): BenchmarkScenario {
  return {
    name: `lifecycle_${size}_${implementation}`,
    description: `Start and stop a batch of ${size} spinners`,
    implementation,
    size,
    setup() {
      const clock = new BenchmarkClock();
      const scheduler = makeScheduler(implementation, clock);
      const spinners = Array.from({ length: size }, () => ({}));
      let advances = 0;
      return {
        runIteration() {
          for (const spinner of spinners)
            scheduler.start(spinner, 80, () => advances++);
          const activeTimers = clock.activeTimers;
          for (const spinner of spinners) scheduler.stop(spinner);
          return activeTimers;
        },
        cleanup() {
          for (const spinner of spinners) scheduler.stop(spinner);
        },
        metrics: () => ({
          advances,
          maxActiveTimers: clock.maxActiveTimers,
          timersCreated: clock.timersCreated,
          timersCleared: clock.timersCleared,
        }),
      };
    },
  };
}

const scenarios: BenchmarkScenario[] = [
  ...([10, 100, 1_000] as const).flatMap((size) => [
    createTickScenario("adaptive-heap", size, false),
    createTickScenario("heap-only", size, false),
    createTickScenario("linear-scan", size, false),
    createTickScenario("adaptive-heap", size, true),
    createTickScenario("heap-only", size, true),
    createTickScenario("linear-scan", size, true),
    createRescheduleScenario("adaptive-heap", size),
    createRescheduleScenario("linear-scan", size),
  ]),
  ...([10, 100, 1_000] as const).flatMap((size) => [
    createLifecycleScenario("adaptive-heap", size),
    createLifecycleScenario("linear-scan", size),
    createLifecycleScenario("per-spinner", size),
  ]),
];

let benchmarkSink = 0;

function consume(value: number): void {
  benchmarkSink = (benchmarkSink + (value | 0)) >>> 0;
}

function parsePositive(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function parseArgs(argv: string[]): BenchmarkArgs {
  const args: BenchmarkArgs = {
    iterations: DEFAULT_ITERATIONS,
    warmupIterations: DEFAULT_WARMUP,
    rounds: DEFAULT_ROUNDS,
    minSampleMs: DEFAULT_MIN_SAMPLE_MS,
    listScenarios: false,
  };
  for (const arg of argv) {
    if (arg === "--list-scenarios") args.listScenarios = true;
    else if (arg.startsWith("--iterations=")) {
      args.iterations = parsePositive(arg.split("=")[1], DEFAULT_ITERATIONS);
    } else if (arg.startsWith("--warmup=")) {
      args.warmupIterations = parsePositive(arg.split("=")[1], DEFAULT_WARMUP);
    } else if (arg.startsWith("--rounds=")) {
      args.rounds = parsePositive(arg.split("=")[1], DEFAULT_ROUNDS);
    } else if (arg.startsWith("--min-sample-ms=")) {
      args.minSampleMs = parsePositive(
        arg.split("=")[1],
        DEFAULT_MIN_SAMPLE_MS,
      );
    } else if (arg.startsWith("--scenario=")) {
      args.scenarioNames = new Set(
        arg.split("=")[1]?.split(",").filter(Boolean),
      );
    } else if (arg.startsWith("--json=")) {
      args.jsonPath = arg.slice("--json=".length);
    }
  }
  return args;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
}

function mean(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function percentile(values: readonly number[], percent: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percent / 100) * sorted.length) - 1),
  );
  return sorted[index] ?? 0;
}

function sampleStdDev(values: readonly number[]): number {
  if (values.length <= 1) return 0;
  const average = mean(values);
  return Math.sqrt(
    values.reduce((total, value) => total + (value - average) ** 2, 0) /
      (values.length - 1),
  );
}

function relativeMarginOfError(values: readonly number[]): number {
  if (values.length <= 1) return 0;
  const average = mean(values);
  const tCritical =
    [12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228][
      values.length - 2
    ] ?? 1.96;
  return Math.abs(
    ((sampleStdDev(values) / Math.sqrt(values.length)) * tCritical * 100) /
      average,
  );
}

function roundIterations(value: number): number {
  if (value <= 1_000) return Math.max(1, Math.ceil(value));
  if (value <= 10_000) return Math.ceil(value / 10) * 10;
  if (value <= 100_000) return Math.ceil(value / 100) * 100;
  return Math.ceil(value / 1_000) * 1_000;
}

function runIterations(
  instance: ScenarioInstance,
  count: number,
  startIteration: number,
): number {
  for (let offset = 0; offset < count; offset++) {
    consume(instance.runIteration(startIteration + offset));
  }
  return startIteration + count;
}

function timeIterations(
  instance: ScenarioInstance,
  count: number,
  startIteration: number,
): { durationMs: number; nextIteration: number } {
  const start = process.hrtime.bigint();
  const nextIteration = runIterations(instance, count, startIteration);
  return {
    durationMs: Number(process.hrtime.bigint() - start) / 1_000_000,
    nextIteration,
  };
}

function runScenario(
  scenario: BenchmarkScenario,
  args: BenchmarkArgs,
): BenchmarkResult {
  const instance = scenario.setup();
  try {
    let nextIteration = runIterations(instance, args.warmupIterations, 0);
    let batchIterations = args.iterations;
    const calibration = timeIterations(
      instance,
      batchIterations,
      nextIteration,
    );
    nextIteration = calibration.nextIteration;
    if (
      calibration.durationMs > 0 &&
      calibration.durationMs < args.minSampleMs
    ) {
      batchIterations = roundIterations(
        (batchIterations * args.minSampleMs) / calibration.durationMs,
      );
      nextIteration = runIterations(
        instance,
        Math.min(batchIterations, args.warmupIterations),
        nextIteration,
      );
    }

    const samples: BenchmarkSample[] = [];
    for (let round = 0; round < args.rounds; round++) {
      const start = process.hrtime.bigint();
      let iterations = 0;
      let durationMs = 0;
      do {
        nextIteration = runIterations(instance, batchIterations, nextIteration);
        iterations += batchIterations;
        durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
      } while (durationMs < args.minSampleMs);
      samples.push({
        round: round + 1,
        iterations,
        durationMs,
        opsPerSecond: (iterations * 1_000) / durationMs,
        nsPerOperation: (durationMs * 1_000_000) / iterations,
      });
    }

    const ns = samples.map((sample) => sample.nsPerOperation);
    const ops = samples.map((sample) => sample.opsPerSecond);
    return {
      name: scenario.name,
      description: scenario.description,
      implementation: scenario.implementation,
      size: scenario.size,
      batchIterations,
      medianNsPerOperation: median(ns),
      p95NsPerOperation: percentile(ns, 95),
      medianOpsPerSecond: median(ops),
      rmePercent: relativeMarginOfError(ns),
      metrics: instance.metrics(),
      samples,
    };
  } finally {
    instance.cleanup();
  }
}

function validateResults(results: BenchmarkResult[]): void {
  for (const result of results) {
    if (result.metrics.maxActiveTimers < 1) {
      throw new Error(`${result.name} performed no timer work`);
    }
    if (
      result.implementation !== "per-spinner" &&
      result.metrics.maxActiveTimers !== 1
    ) {
      throw new Error(`${result.name} exceeded one active timer`);
    }
    if (
      result.implementation === "per-spinner" &&
      result.name.startsWith("lifecycle_") &&
      result.metrics.maxActiveTimers !== result.size
    ) {
      throw new Error(`${result.name} did not create one timer per spinner`);
    }
    if (result.name.startsWith("tick_") && result.metrics.advances === 0) {
      throw new Error(`${result.name} advanced no spinners`);
    }
  }
}

function hashTrace(trace: readonly number[]): number {
  let hash = 2166136261;
  for (const value of trace) {
    hash ^= value;
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}

function verifyEquivalentBehavior(): number {
  const traces: number[][] = [];

  for (const implementation of [
    "adaptive-heap",
    "heap-only",
    "linear-scan",
  ] as const) {
    const clock = new BenchmarkClock();
    const scheduler = makeScheduler(implementation, clock);
    const spinners = [{}, {}, {}];
    const trace: number[] = [];

    scheduler.start(spinners[0], 20, () => trace.push(0));
    scheduler.start(spinners[1], 80, () => trace.push(1));
    scheduler.start(spinners[2], 100, () => trace.push(2));
    clock.fireNext();
    scheduler.reschedule(spinners[1], 40);
    clock.fireNext();
    scheduler.stop(spinners[0]);
    clock.fireNext();
    scheduler.stop(spinners[1]);
    scheduler.stop(spinners[2]);

    if (clock.activeTimers !== 0 || clock.maxActiveTimers !== 1) {
      throw new Error(`${implementation} failed timer invariants`);
    }
    traces.push(trace);
  }

  const expected = JSON.stringify(traces[0]);
  if (traces.some((trace) => JSON.stringify(trace) !== expected)) {
    throw new Error(
      `Scheduler implementations produced different traces: ${JSON.stringify(traces)}`,
    );
  }
  return hashTrace(traces[0]);
}

function format(value: number): string {
  return value.toFixed(2);
}

function printResults(
  results: BenchmarkResult[],
  args: BenchmarkArgs,
  correctnessChecksum: number,
): void {
  console.log(
    `scheduler-benchmark warmup=${args.warmupIterations} rounds=${args.rounds} min_sample_ms=${args.minSampleMs} scenarios=${results.length} checksum=${correctnessChecksum}`,
  );
  const header = [
    "scenario",
    "implementation",
    "size",
    "median ns/op",
    "p95 ns/op",
    "median ops/sec",
    "rme %",
    "max timers",
  ];
  const rows = results.map((result) => [
    result.name.replace(`_${result.implementation}`, ""),
    result.implementation,
    String(result.size),
    format(result.medianNsPerOperation),
    format(result.p95NsPerOperation),
    format(result.medianOpsPerSecond),
    format(result.rmePercent),
    String(result.metrics.maxActiveTimers),
  ]);
  const widths = header.map((cell, index) =>
    Math.max(cell.length, ...rows.map((row) => row[index]?.length ?? 0)),
  );
  for (const [index, row] of [header, ...rows].entries()) {
    console.log(
      row.map((cell, column) => cell.padEnd(widths[column])).join("  "),
    );
    if (index === 0) {
      console.log(widths.map((width) => "-".repeat(width)).join("  "));
    }
  }
}

function writeResults(
  results: BenchmarkResult[],
  jsonPath: string,
  correctnessChecksum: number,
): void {
  const absolutePath = path.resolve(jsonPath);
  const git = (args: string[]): string | undefined => {
    try {
      return execFileSync("git", args, { encoding: "utf8" }).trim();
    } catch {
      return undefined;
    }
  };
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(
    absolutePath,
    JSON.stringify(
      {
        meta: {
          benchmarkVersion: BENCHMARK_VERSION,
          timestamp: new Date().toISOString(),
          args: process.argv.slice(2),
          runtime: {
            bun: Bun.version,
            node: process.versions.node,
            v8: process.versions.v8,
            platform: process.platform,
            arch: process.arch,
          },
          cpu: cpus()[0]?.model,
          git: {
            commit: git(["rev-parse", "HEAD"]),
            branch: git(["branch", "--show-current"]),
            dirty: Boolean(git(["status", "--porcelain"])),
          },
          correctnessChecksum,
        },
        results,
      },
      null,
      2,
    ),
  );
}

const args = parseArgs(process.argv.slice(2));
if (args.listScenarios) {
  for (const scenario of scenarios) {
    console.log(`${scenario.name}\t${scenario.description}`);
  }
} else {
  const correctnessChecksum = verifyEquivalentBehavior();
  const selected = args.scenarioNames
    ? scenarios.filter((scenario) => args.scenarioNames?.has(scenario.name))
    : scenarios;
  if (selected.length === 0) throw new Error("No benchmark scenarios matched");
  const results = selected.map((scenario) => runScenario(scenario, args));
  validateResults(results);
  printResults(results, args, correctnessChecksum);
  if (args.jsonPath) writeResults(results, args.jsonPath, correctnessChecksum);
}
