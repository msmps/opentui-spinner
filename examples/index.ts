import {
  BoxRenderable,
  type CliRenderer,
  createCliRenderer,
  type KeyEvent,
  type SelectOption,
  SelectRenderable,
  SelectRenderableEvents,
  TextRenderable,
} from "@opentui/core";
import { SpinnerRenderable } from "../src/index";
import {
  builtInSpinnerNames,
  customSpinners,
  exampleDefinitions,
  galleryPageSize,
  opencodeFrames,
  scannerFrames,
} from "./shared";

interface Scene {
  root: BoxRenderable;
  key?: (key: KeyEvent) => void;
}

class CoreExamples {
  private readonly menu: BoxRenderable;
  private scene: Scene | undefined;

  constructor(private readonly renderer: CliRenderer) {
    renderer.consoleMode = "console-overlay";
    renderer.setTerminalTitle("opentui-spinner Core examples");

    this.menu = new BoxRenderable(renderer, {
      width: "100%",
      height: "100%",
      flexDirection: "column",
      padding: 1,
      backgroundColor: "#07111f",
    });
    renderer.root.add(this.menu);
    this.menu.add(
      new TextRenderable(renderer, {
        content: "OPENTUI SPINNER · CORE",
        fg: "#38bdf8",
        height: 2,
      }),
    );

    const select = new SelectRenderable(renderer, {
      options: exampleDefinitions.map((example, value) => ({
        ...example,
        value,
      })),
      height: "100%",
      showDescription: true,
      showScrollIndicator: true,
      wrapSelection: true,
      selectedBackgroundColor: "#164e63",
      selectedTextColor: "#67e8f9",
      backgroundColor: "transparent",
      focusedBackgroundColor: "transparent",
    });
    this.menu.add(select);
    this.menu.add(
      new TextRenderable(renderer, {
        content:
          "↑↓/j/k choose · Enter open · Esc back · ` console · . debug · Ctrl+G hit grid · Ctrl+C quit",
        fg: "#94a3b8",
        height: 1,
      }),
    );
    select.on(
      SelectRenderableEvents.ITEM_SELECTED,
      (_index: number, option: SelectOption) => this.open(Number(option.value)),
    );
    select.focus();

    renderer.keyInput.on("keypress", (key) => this.onKey(key));
  }

  private onKey(key: KeyEvent): void {
    if (key.name === "`") {
      this.renderer.console.toggle();
    } else if (key.name === ".") {
      this.renderer.toggleDebugOverlay();
    } else if (key.ctrl && key.name === "g") {
      this.renderer.dumpHitGrid();
    } else if (key.name === "escape" && this.scene) {
      this.scene.root.destroy();
      this.scene = undefined;
      this.menu.visible = true;
      this.renderer.requestRender();
    } else {
      this.scene?.key?.(key);
    }
  }

  private sceneRoot(
    title: string,
    hint = "Esc returns to examples",
  ): BoxRenderable {
    const root = new BoxRenderable(this.renderer, {
      width: "100%",
      height: "100%",
      flexDirection: "column",
      padding: 1,
      backgroundColor: "#07111f",
    });
    root.add(
      new TextRenderable(this.renderer, {
        content: title,
        fg: "#67e8f9",
        height: 2,
      }),
    );
    root.add(
      new TextRenderable(this.renderer, {
        content: hint,
        fg: "#64748b",
        height: 1,
      }),
    );
    this.renderer.root.add(root);
    return root;
  }

  private addSpinner(
    root: BoxRenderable,
    label: string,
    options: ConstructorParameters<typeof SpinnerRenderable>[1],
  ): void {
    const row = new BoxRenderable(this.renderer, {
      flexDirection: "row",
      height: 1,
    });
    row.add(new SpinnerRenderable(this.renderer, options));
    row.add(
      new TextRenderable(this.renderer, {
        content: `  ${label}`,
        fg: "#cbd5e1",
      }),
    );
    root.add(row);
  }

  private open(index: number): void {
    this.menu.visible = false;
    if (index === 0) {
      const root = this.sceneRoot("Basic spinner lifecycle");
      this.addSpinner(root, "dots · cyan", { name: "dots", color: "#22d3ee" });
      this.addSpinner(root, "bouncingBall · violet", {
        name: "bouncingBall",
        color: "#a78bfa",
      });
      this.addSpinner(root, "weather · amber", {
        name: "weather",
        color: "#fbbf24",
      });
      this.scene = { root };
    } else if (index === 1) {
      this.openGallery();
    } else if (index === 2) {
      const root = this.sceneRoot("Custom frames and color generators");
      for (const custom of customSpinners)
        this.addSpinner(root, custom.label, custom.options);
      this.scene = { root };
    } else if (index === 3) {
      const root = this.sceneRoot(
        "Knight Rider scanner",
        "Esc back · custom frames at 40ms",
      );
      this.addSpinner(root, "bidirectional custom trail", {
        frames: scannerFrames,
        interval: 40,
        color: "#ef4444",
      });
      this.scene = { root };
    } else {
      const root = this.sceneRoot(
        "OpenCode trail",
        "Esc back · long custom frames with a wave palette",
      );
      this.addSpinner(root, "OpenCode-style moving marker", {
        frames: opencodeFrames,
        interval: 80,
        color: customSpinners[1].options.color,
      });
      this.scene = { root };
    }
  }

  private openGallery(): void {
    let page = 0;
    const pageCount = Math.ceil(builtInSpinnerNames.length / galleryPageSize);
    const root = this.sceneRoot(
      "Every built-in spinner",
      "←/→ or h/l pages · Esc back",
    );
    const content = new BoxRenderable(this.renderer, {
      flexDirection: "column",
      flexGrow: 1,
    });
    root.add(content);

    const renderPage = () => {
      for (const child of content.getChildren()) child.destroy();
      const start = page * galleryPageSize;
      for (const name of builtInSpinnerNames.slice(
        start,
        start + galleryPageSize,
      )) {
        this.addSpinner(content, name, { name });
      }
      content.add(
        new TextRenderable(this.renderer, {
          content: `Page ${page + 1}/${pageCount} · ${start + 1}-${Math.min(start + galleryPageSize, builtInSpinnerNames.length)} of ${builtInSpinnerNames.length}`,
          fg: "#64748b",
        }),
      );
    };
    renderPage();
    this.scene = {
      root,
      key: (key) => {
        if (key.name === "right" || key.name === "l")
          page = (page + 1) % pageCount;
        else if (key.name === "left" || key.name === "h")
          page = (page - 1 + pageCount) % pageCount;
        else return;
        renderPage();
      },
    };
  }
}

const renderer = await createCliRenderer();
new CoreExamples(renderer);
