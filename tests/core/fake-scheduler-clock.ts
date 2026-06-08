import type { SpinnerSchedulerClock } from "../../src/scheduler";

interface Timer {
  callback: () => void;
  delay: number;
  dueAt: number;
}

export class FakeSchedulerClock implements SpinnerSchedulerClock {
  public nowValue = 0;
  public readonly delays: number[] = [];
  public readonly callbacks: Array<() => void> = [];
  public readonly cleared: ReturnType<typeof setInterval>[] = [];
  public readonly firedAt: number[] = [];
  public maxActiveTimers = 0;

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
    this.delays.push(delay);
    this.callbacks.push(callback);
    this.timers.set(handle, {
      callback,
      delay,
      dueAt: this.nowValue + delay,
    });
    this.maxActiveTimers = Math.max(this.maxActiveTimers, this.timers.size);
    return handle;
  }

  public clearInterval(handle: ReturnType<typeof setInterval>): void {
    this.cleared.push(handle);
    this.timers.delete(handle);
  }

  public get activeTimers(): number {
    return this.timers.size;
  }

  public advance(milliseconds: number): void {
    const target = this.nowValue + milliseconds;

    while (true) {
      const next = Array.from(this.timers.entries()).reduce<
        [ReturnType<typeof setInterval>, Timer] | undefined
      >((earliest, candidate) => {
        if (candidate[1].dueAt > target) return earliest;
        if (!earliest || candidate[1].dueAt < earliest[1].dueAt) {
          return candidate;
        }
        return earliest;
      }, undefined);
      if (!next) break;

      const [handle, timer] = next;
      this.nowValue = timer.dueAt;
      this.firedAt.push(this.nowValue);
      timer.callback();
      if (this.timers.get(handle) === timer) {
        timer.dueAt = this.nowValue + timer.delay;
      }
    }

    this.nowValue = target;
  }
}
