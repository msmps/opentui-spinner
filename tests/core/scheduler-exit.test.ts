import { expect, it } from "bun:test";

it("does not keep a process alive while animation is the only active work", async () => {
  const child = Bun.spawn(
    [
      process.execPath,
      "-e",
      'import { SpinnerScheduler } from "./src/scheduler.ts"; new SpinnerScheduler().start({}, 1000, () => {});',
    ],
    {
      cwd: `${import.meta.dir}/../..`,
      stdout: "ignore",
      stderr: "pipe",
    },
  );
  const result = await Promise.race([
    child.exited.then((exitCode) => ({ exitCode })),
    Bun.sleep(1_000).then(() => ({ exitCode: undefined })),
  ]);

  if (result.exitCode === undefined) child.kill();

  expect(result.exitCode).toBe(0);
}, 2_000);
