export const MIN_SPINNER_INTERVAL = 1000 / 60;
export const MAX_SPINNER_INTERVAL = 1000;

export function validateSpinnerInterval(interval: number): number {
  if (
    !Number.isFinite(interval) ||
    interval < MIN_SPINNER_INTERVAL ||
    interval > MAX_SPINNER_INTERVAL
  ) {
    throw new RangeError(
      `Spinner interval must be a finite number between ${MIN_SPINNER_INTERVAL}ms and ${MAX_SPINNER_INTERVAL}ms`,
    );
  }

  return interval;
}

interface ScheduledSpinner {
  spinner: object;
  interval: number;
  nextDueAt: number;
  advance: () => void;
}

export interface SpinnerSchedulerClock {
  now(): number;
  setInterval(
    callback: () => void,
    delay: number,
  ): ReturnType<typeof setInterval>;
  clearInterval(handle: ReturnType<typeof setInterval>): void;
}

const systemClock: SpinnerSchedulerClock = {
  now: () => performance.now(),
  setInterval: (callback, delay) => setInterval(callback, delay),
  clearInterval: (handle) => clearInterval(handle),
};

class SpinnerScheduler {
  private readonly active = new Map<object, ScheduledSpinner>();
  private heap: ScheduledSpinner[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private timerDueAt = 0;
  private generation = 0;
  private lastWakeAt = Number.NEGATIVE_INFINITY;
  private clock: SpinnerSchedulerClock = systemClock;

  public setClock(clock: SpinnerSchedulerClock): void {
    if (this.active.size > 0 || this.timer !== null) {
      throw new Error(
        "Cannot replace the spinner scheduler clock while active",
      );
    }
    this.clock = clock;
  }

  public start(spinner: object, interval: number, advance: () => void): void {
    if (this.active.has(spinner)) return;

    const registration = {
      spinner,
      interval,
      nextDueAt: this.clock.now() + interval,
      advance,
    };
    this.active.set(spinner, registration);
    this.push(registration);
    this.armNext();
  }

  public reschedule(spinner: object, interval: number): void {
    const registration = this.active.get(spinner);
    if (!registration) return;

    const replacement = {
      spinner,
      interval,
      nextDueAt: this.clock.now() + interval,
      advance: registration.advance,
    };
    this.active.set(spinner, replacement);
    this.push(replacement);
    this.compactIfNeeded();
    this.armNext();
  }

  public stop(spinner: object): void {
    if (!this.active.delete(spinner)) return;

    this.compactIfNeeded();
    this.armNext();
  }

  private armNext(): void {
    this.discardStaleRoots();
    const next = this.heap[0];

    if (!next) {
      this.cancelTimer();
      this.lastWakeAt = Number.NEGATIVE_INFINITY;
      return;
    }

    const now = this.clock.now();
    const dueAt = Math.max(
      next.nextDueAt,
      this.lastWakeAt + MIN_SPINNER_INTERVAL,
    );
    if (this.timer !== null && this.timerDueAt === dueAt) return;

    this.cancelTimer();
    const generation = this.generation;
    const delay = Math.max(dueAt - now, 0);
    this.timerDueAt = dueAt;
    this.timer = this.clock.setInterval(() => this.tick(generation), delay);
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
    this.discardStaleRoots();
    let advanced = false;

    while (this.heap[0] && this.heap[0].nextDueAt <= now) {
      const registration = this.pop();
      if (!registration || !this.isCurrent(registration)) continue;

      registration.advance();
      advanced = true;

      if (!this.isCurrent(registration)) continue;

      registration.nextDueAt = now + registration.interval;
      this.push(registration);
    }

    if (advanced) this.lastWakeAt = now;
    this.compactIfNeeded();
    this.armNext();
  }

  private isCurrent(registration: ScheduledSpinner): boolean {
    return this.active.get(registration.spinner) === registration;
  }

  private discardStaleRoots(): void {
    while (this.heap[0] && !this.isCurrent(this.heap[0])) this.pop();
  }

  private compactIfNeeded(): void {
    if (this.heap.length <= this.active.size * 2 + 16) return;

    this.heap = Array.from(this.active.values());
    for (let i = Math.floor(this.heap.length / 2) - 1; i >= 0; i--) {
      this.siftDown(i);
    }
  }

  private push(entry: ScheduledSpinner): void {
    this.heap.push(entry);
    let index = this.heap.length - 1;

    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.heap[parent].nextDueAt <= entry.nextDueAt) break;
      this.heap[index] = this.heap[parent];
      index = parent;
    }
    this.heap[index] = entry;
  }

  private pop(): ScheduledSpinner | undefined {
    const root = this.heap[0];
    const last = this.heap.pop();
    if (!root || !last || this.heap.length === 0) return root;

    this.heap[0] = last;
    this.siftDown(0);
    return root;
  }

  private siftDown(start: number): void {
    const entry = this.heap[start];
    let index = start;

    while (true) {
      const left = index * 2 + 1;
      if (left >= this.heap.length) break;
      const right = left + 1;
      const child =
        right < this.heap.length &&
        this.heap[right].nextDueAt < this.heap[left].nextDueAt
          ? right
          : left;
      if (this.heap[child].nextDueAt >= entry.nextDueAt) break;
      this.heap[index] = this.heap[child];
      index = child;
    }
    this.heap[index] = entry;
  }
}

export const spinnerScheduler = new SpinnerScheduler();

export function setSpinnerSchedulerClockForTesting(
  clock: SpinnerSchedulerClock | undefined,
): void {
  spinnerScheduler.setClock(clock ?? systemClock);
}
