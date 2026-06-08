import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const packageRoot = join(import.meta.dir, "../..");
let temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
  temporaryDirectories = [];
});

async function run(command: string[], cwd: string): Promise<string> {
  const process = Bun.spawn(command, {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    process.exited,
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
  ]);

  if (exitCode !== 0) {
    throw new Error(`${command.join(" ")} failed:\n${stderr}`);
  }

  return stdout;
}

async function pack(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "opentui-spinner-pack-"));
  temporaryDirectories.push(directory);
  await run(
    [process.execPath, "pm", "pack", "--destination", directory],
    packageRoot,
  );
  const manifest = JSON.parse(
    await readFile(join(packageRoot, "package.json"), "utf8"),
  ) as { version: string };
  return join(directory, `opentui-spinner-${manifest.version}.tgz`);
}

async function createConsumer(
  tarball: string,
  dependencies: Record<string, string>,
): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "opentui-spinner-consumer-"));
  temporaryDirectories.push(directory);
  await writeFile(
    join(directory, "package.json"),
    JSON.stringify({
      name: "spinner-consumer",
      private: true,
      type: "module",
      dependencies: {
        "opentui-spinner": `file:${tarball}`,
        ...dependencies,
      },
    }),
  );
  await run([process.execPath, "install", "--offline"], directory);
  return directory;
}

describe("packed package", () => {
  it("loads the root export without optional framework peers", async () => {
    const tarball = await pack();
    const consumer = await createConsumer(tarball, {
      "@opentui/core": "0.3.4",
      typescript: "^5",
    });

    const output = await run(
      [
        process.execPath,
        "-e",
        'import { SpinnerRenderable, createPulse, createWave } from "opentui-spinner"; console.log([typeof SpinnerRenderable, typeof createPulse, typeof createWave].join(","))',
      ],
      consumer,
    );

    expect(output.trim()).toBe("function,function,function");
  }, 30_000);

  it("contains declarations and loads both framework adapters", async () => {
    const tarball = await pack();
    const consumer = await createConsumer(tarball, {
      "@opentui/core": "0.3.4",
      "@opentui/react": "0.3.4",
      "@opentui/solid": "0.3.4",
      react: "^19.2.0",
      "solid-js": "1.9.12",
      typescript: "^5",
    });

    const spinnerPackage = JSON.parse(
      await readFile(
        join(consumer, "node_modules/opentui-spinner/package.json"),
        "utf8",
      ),
    ) as {
      exports: Record<string, { import: { types: string; default: string } }>;
    };

    for (const entry of [".", "./react", "./solid"]) {
      const exported = spinnerPackage.exports[entry]?.import;
      expect(exported).toBeDefined();
      if (!exported) throw new Error(`Missing package export: ${entry}`);
      expect(
        await readFile(
          join(consumer, "node_modules/opentui-spinner", exported.types),
          "utf8",
        ),
      ).not.toBeEmpty();
      expect(
        await readFile(
          join(consumer, "node_modules/opentui-spinner", exported.default),
          "utf8",
        ),
      ).not.toBeEmpty();
    }

    await writeFile(
      join(consumer, "index.ts"),
      [
        'import { SpinnerRenderable, createPulse, createWave } from "opentui-spinner";',
        'import "opentui-spinner/react";',
        'import "opentui-spinner/solid";',
        'import type { OpenTUIComponents as ReactComponents } from "@opentui/react";',
        'import type { OpenTUIComponents as SolidComponents } from "@opentui/solid";',
        "const renderable: typeof SpinnerRenderable = SpinnerRenderable;",
        'const pulse = createPulse(["red"]);',
        'const wave = createWave(["blue"]);',
        'type ReactSpinner = ReactComponents["spinner"];',
        'type SolidSpinner = SolidComponents["spinner"];',
        "void ([renderable, pulse, wave] satisfies [ReactSpinner, unknown, unknown]);",
        "void (null as unknown as SolidSpinner);",
      ].join("\n"),
    );
    await writeFile(
      join(consumer, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          strict: true,
          noEmit: true,
          skipLibCheck: true,
          module: "Preserve",
          moduleResolution: "bundler",
        },
        include: ["index.ts"],
      }),
    );
    await run([join(consumer, "node_modules/.bin/tsc"), "--noEmit"], consumer);

    const output = await run(
      [
        process.execPath,
        "-e",
        'const react = await import("opentui-spinner/react"); const solid = await import("opentui-spinner/solid"); console.log([typeof react.registerSpinner, typeof solid.registerSpinner].join(","))',
      ],
      consumer,
    );

    expect(output.trim()).toBe("function,function");
  }, 30_000);
});
