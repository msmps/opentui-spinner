import { render, useKeyboard, useRenderer } from "@opentui/solid";
import { createSignal, For, Match, Switch } from "solid-js";
import "../src/solid";
import {
  builtInSpinnerNames,
  customSpinners,
  exampleDefinitions,
  galleryPageSize,
  opencodeFrames,
  scannerFrames,
} from "./shared";

function Frame(props: { title: string; hint?: string; children: unknown }) {
  return (
    <box
      width="100%"
      height="100%"
      flexDirection="column"
      padding={1}
      backgroundColor="#07111f"
    >
      <text fg="#67e8f9" height={2}>
        {props.title}
      </text>
      <text fg="#64748b" height={1}>
        {props.hint ?? "Esc returns to examples"}
      </text>
      {props.children}
    </box>
  );
}

function Basic() {
  return (
    <Frame title="Basic spinner lifecycle">
      <box flexDirection="row" height={1}>
        <spinner name="dots" color="#22d3ee" />
        <text fg="#cbd5e1"> dots · cyan</text>
      </box>
      <box flexDirection="row" height={1}>
        <spinner name="bouncingBall" color="#a78bfa" />
        <text fg="#cbd5e1"> bouncingBall · violet</text>
      </box>
      <box flexDirection="row" height={1}>
        <spinner name="weather" color="#fbbf24" />
        <text fg="#cbd5e1"> weather · amber</text>
      </box>
    </Frame>
  );
}

function Gallery() {
  const [page, setPage] = createSignal(0);
  const pageCount = Math.ceil(builtInSpinnerNames.length / galleryPageSize);
  useKeyboard((key) => {
    if (key.name === "right" || key.name === "l")
      setPage((value) => (value + 1) % pageCount);
    if (key.name === "left" || key.name === "h")
      setPage((value) => (value - 1 + pageCount) % pageCount);
  });
  const names = () =>
    builtInSpinnerNames.slice(
      page() * galleryPageSize,
      (page() + 1) * galleryPageSize,
    );
  return (
    <Frame title="Every built-in spinner" hint="←/→ or h/l pages · Esc back">
      <For each={names()}>
        {(name) => (
          <box flexDirection="row" height={1}>
            <spinner name={name} />
            <text fg="#cbd5e1"> {name}</text>
          </box>
        )}
      </For>
      <text fg="#64748b">
        Page {page() + 1}/{pageCount} · {page() * galleryPageSize + 1}-
        {Math.min((page() + 1) * galleryPageSize, builtInSpinnerNames.length)}{" "}
        of {builtInSpinnerNames.length}
      </text>
    </Frame>
  );
}

function Custom() {
  return (
    <Frame title="Custom frames and color generators">
      <For each={customSpinners}>
        {({ label, options }) => (
          <box flexDirection="row" height={1}>
            <spinner {...options} />
            <text fg="#cbd5e1"> {label}</text>
          </box>
        )}
      </For>
    </Frame>
  );
}

function Scanner() {
  return (
    <Frame title="Knight Rider scanner" hint="Esc back · custom frames at 40ms">
      <box flexDirection="row" height={1}>
        <spinner frames={scannerFrames} interval={40} color="#ef4444" />
        <text fg="#cbd5e1"> bidirectional custom trail</text>
      </box>
    </Frame>
  );
}

function OpenCodeTrail() {
  return (
    <Frame
      title="OpenCode trail"
      hint="Esc back · long custom frames with a wave palette"
    >
      <box flexDirection="row" height={1}>
        <spinner
          frames={opencodeFrames}
          interval={80}
          color={customSpinners[1].options.color}
        />
        <text fg="#cbd5e1"> OpenCode-style moving marker</text>
      </box>
    </Frame>
  );
}

function App() {
  const renderer = useRenderer();
  const [selected, setSelected] = createSignal(-1);
  renderer.consoleMode = "console-overlay";
  useKeyboard((key) => {
    if (key.ctrl && key.name === "c") renderer.destroy();
    else if (key.name === "escape") setSelected(-1);
    else if (key.name === "`") renderer.console.toggle();
    else if (key.name === ".") renderer.toggleDebugOverlay();
    else if (key.ctrl && key.name === "g") renderer.dumpHitGrid();
  });

  return (
    <Switch>
      <Match when={selected() === 0}>
        <Basic />
      </Match>
      <Match when={selected() === 1}>
        <Gallery />
      </Match>
      <Match when={selected() === 2}>
        <Custom />
      </Match>
      <Match when={selected() === 3}>
        <Scanner />
      </Match>
      <Match when={selected() === 4}>
        <OpenCodeTrail />
      </Match>
      <Match when={selected() === -1}>
        <box
          width="100%"
          height="100%"
          flexDirection="column"
          padding={1}
          backgroundColor="#07111f"
        >
          <text fg="#38bdf8" height={2}>
            OPENTUI SPINNER · SOLID
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
            ↑↓/j/k choose · Enter open · Esc back · ` console · . debug · Ctrl+G
            hit grid · Ctrl+C quit
          </text>
        </box>
      </Match>
    </Switch>
  );
}

await render(() => <App />, { exitOnCtrlC: false });
