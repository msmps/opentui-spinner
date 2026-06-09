import { createCliRenderer } from "@opentui/core";
import { createRoot, useKeyboard, useRenderer } from "@opentui/react";
import { createElement, useState } from "react";
import type { SpinnerOptions } from "../src/index";
import "../src/react";
import {
  builtInSpinnerNames,
  customSpinners,
  exampleDefinitions,
  exitAfterRendererDestroy,
  galleryPageSize,
  opencodeFrames,
  scannerFrames,
} from "./shared";

function Frame({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <box
      width="100%"
      height="100%"
      flexDirection="column"
      padding={1}
      backgroundColor="#07111f"
    >
      <text fg="#67e8f9" height={2}>
        {title}
      </text>
      <text fg="#64748b" height={1}>
        {hint ?? "Esc returns to examples"}
      </text>
      {children}
    </box>
  );
}

function SpinnerRow({ label, ...options }: { label: string } & SpinnerOptions) {
  return (
    <box flexDirection="row" height={1}>
      <spinner {...options} />
      <text fg="#cbd5e1"> {label}</text>
    </box>
  );
}

function Basic() {
  return (
    <Frame title="Basic spinner lifecycle">
      <SpinnerRow label="dots · cyan" name="dots" color="#22d3ee" />
      <SpinnerRow
        label="bouncingBall · violet"
        name="bouncingBall"
        color="#a78bfa"
      />
      <SpinnerRow label="weather · amber" name="weather" color="#fbbf24" />
    </Frame>
  );
}

function Gallery() {
  const [page, setPage] = useState(0);
  const pageCount = Math.ceil(builtInSpinnerNames.length / galleryPageSize);
  useKeyboard((key) => {
    if (key.name === "right" || key.name === "l")
      setPage((value) => (value + 1) % pageCount);
    if (key.name === "left" || key.name === "h")
      setPage((value) => (value - 1 + pageCount) % pageCount);
  });
  const start = page * galleryPageSize;
  return (
    <Frame title="Every built-in spinner" hint="←/→ or h/l pages · Esc back">
      {builtInSpinnerNames.slice(start, start + galleryPageSize).map((name) => (
        <SpinnerRow key={name} label={name} name={name} />
      ))}
      <text fg="#64748b">
        Page {page + 1}/{pageCount} · {start + 1}-
        {Math.min(start + galleryPageSize, builtInSpinnerNames.length)} of{" "}
        {builtInSpinnerNames.length}
      </text>
    </Frame>
  );
}

function Custom() {
  return (
    <Frame title="Custom frames and color generators">
      {customSpinners.map(({ label, options }) => (
        <SpinnerRow key={label} label={label} {...options} />
      ))}
    </Frame>
  );
}

function Scanner() {
  return (
    <Frame title="Knight Rider scanner" hint="Esc back · custom frames at 40ms">
      <SpinnerRow
        label="bidirectional custom trail"
        frames={scannerFrames}
        interval={40}
        color="#ef4444"
      />
    </Frame>
  );
}

function OpenCodeTrail() {
  return (
    <Frame
      title="OpenCode trail"
      hint="Esc back · long custom frames with a wave palette"
    >
      <SpinnerRow
        label="OpenCode-style moving marker"
        frames={opencodeFrames}
        interval={80}
        color={customSpinners[1].options.color}
      />
    </Frame>
  );
}

const scenes = [Basic, Gallery, Custom, Scanner, OpenCodeTrail];

function App() {
  const renderer = useRenderer();
  const [selected, setSelected] = useState(-1);
  renderer.consoleMode = "console-overlay";
  useKeyboard((key) => {
    if (key.name === "escape") setSelected(-1);
    else if (key.name === "`") renderer.console.toggle();
    else if (key.name === ".") renderer.toggleDebugOverlay();
    else if (key.ctrl && key.name === "g") renderer.dumpHitGrid();
  });

  const Scene = scenes[selected];
  if (Scene) return createElement(Scene);
  return (
    <box
      width="100%"
      height="100%"
      flexDirection="column"
      padding={1}
      backgroundColor="#07111f"
    >
      <text fg="#38bdf8" height={2}>
        OPENTUI SPINNER · REACT
      </text>
      <select
        focused
        height="100%"
        options={exampleDefinitions.map((example, value) => ({
          ...example,
          value,
        }))}
        onSelect={setSelected}
        showDescription
        showScrollIndicator
        wrapSelection
        selectedBackgroundColor="#164e63"
        selectedTextColor="#67e8f9"
        backgroundColor="transparent"
        focusedBackgroundColor="transparent"
      />
      <text fg="#94a3b8">
        ↑↓/j/k choose · Enter open · Esc back · ` console · . debug · Ctrl+G hit
        grid · Ctrl+C quit
      </text>
    </box>
  );
}

const renderer = await createCliRenderer({
  onDestroy: exitAfterRendererDestroy,
});
createRoot(renderer).render(<App />);
