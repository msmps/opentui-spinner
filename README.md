# opentui-spinner

A small & opinionated spinner library for terminal UIs built on [OpenTUI](https://github.com/sst/opentui).

## Features

- **Built-in Spinners** - Powered by [cli-spinners](https://github.com/sindresorhus/cli-spinners)
- **Custom Spinners** - Create your own with custom frames and intervals
- **React Support** - First-class React integration via OpenTUI React
- **SolidJS Support** - First-class SolidJS integration via OpenTUI Solid
- **Type-Safe** - Full TypeScript support

## Installation

```bash
bun add opentui-spinner @opentui/core
```

For React support:

```bash
bun add opentui-spinner @opentui/core @opentui/react react
```

For SolidJS support:

```bash
bun add opentui-spinner @opentui/core @opentui/solid solid-js
```

## Usage

### Basic Usage (Core)

```typescript
import { createCliRenderer } from "@opentui/core";
import { SpinnerRenderable } from "opentui-spinner";

const renderer = await createCliRenderer();
engine.attach(renderer);

const spinner = new SpinnerRenderable(renderer, {
  name: "dots",
  color: "cyan",
});

renderer.root.add(spinner);
```

### With Text Label

```typescript
import {
  BoxRenderable,
  createCliRenderer,
  engine,
  TextRenderable,
} from "@opentui/core";
import { SpinnerRenderable } from "opentui-spinner";

const renderer = await createCliRenderer();
engine.attach(renderer);

const container = new BoxRenderable(renderer, {
  border: true,
  flexDirection: "row",
  alignItems: "center",
});

const spinner = new SpinnerRenderable(renderer, {
  name: "bouncingBall",
});

const label = new TextRenderable(renderer, {
  content: "Loading...",
  marginLeft: 1,
});

container.add(spinner);
container.add(label);
renderer.root.add(container);
```

### React Usage

First, import the React extension:

```tsx
import "opentui-spinner/react";
```

Then use the `<spinner>` component in your OpenTUI React app:

```tsx
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import "opentui-spinner/react";

function App() {
  return (
    <box alignItems="center" flexDirection="row">
      <spinner name="dots" color="cyan" />
      <text marginLeft={1}>Loading...</text>
    </box>
  );
}

const renderer = await createCliRenderer();
createRoot(renderer).render(<App />);
```

### SolidJS Usage

First, import the SolidJS extension:

```tsx
import "opentui-spinner/solid";
```

Then use the `<spinner>` component in your OpenTUI SolidJS app:

```tsx
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/solid";
import { createSignal, onCleanup } from "solid-js";
import "opentui-spinner/solid";

const loadingSteps = [
  "Initializing...",
  "Loading dependencies...",
  "Loading configuration...",
  "Loading data...",
  "Processing data...",
  "Done!",
];

function App() {
  const [step, setCurrentStep] = createSignal<number>(0);

  const interval = setInterval(() => {
    setCurrentStep((prev) => (prev + 1) % loadingSteps.length);
  }, 1000);

  onCleanup(() => clearInterval(interval));

  return (
    <box alignItems="center" flexDirection="row">
      <spinner name="dots" color="cyan" />
      <text marginLeft={1}> {loadingSteps[step()]}</text>
    </box>
  );
}

const renderer = await createCliRenderer();
createRoot(renderer).render(() => <App />);
```

## API Reference

### SpinnerOptions

| Option            | Type          | Default         | Description                                  |
| ----------------- | ------------- | --------------- | -------------------------------------------- |
| `name`            | `SpinnerName` | `"dots"`        | Name of a built-in spinner from cli-spinners |
| `frames`          | `string[]`    | -               | Custom animation frames (overrides `name`)   |
| `interval`        | `number`      | -               | Time between frames in milliseconds          |
| `autoplay`        | `boolean`     | `true`          | Whether to start playing automatically       |
| `loop`            | `boolean`     | `true`          | Whether to loop the animation                |
| `color`           | `ColorInput`  | `"white"`       | Foreground color                             |
| `backgroundColor` | `ColorInput`  | `"transparent"` | Background color                             |

### SpinnerRenderable Methods

#### `start(): void`

Start or resume the spinner animation.

```typescript
spinner.start();
```

#### `stop(): void`

Pause the spinner animation.

```typescript
spinner.stop();
```

### Properties

All options can be updated dynamically via properties:

```typescript
// Change spinner type
spinner.name = "line";

// Update color
spinner.color = "green";

// Change frames
spinner.frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

// Adjust interval
spinner.interval = 100;
```

## Available Spinners

The library includes 80+ spinners from [cli-spinners](https://github.com/sindresorhus/cli-spinners). Popular choices include:

- `dots` - Simple dots (⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏)
- `dots2` - Alternative dots
- `dots3` through `dots12` - Various dot styles
- `line` - Rotating line (- \\ | /)
- `pipe` - Simple pipe animation
- `star` - Rotating star
- `arc` - Arc animation
- `circle` - Circle segments
- `squareCorners` - Rotating square corners
- `circleQuarters` - Quarter circles
- `circleHalves` - Half circles
- `bouncingBar` - Bouncing bar
- `bouncingBall` - Bouncing ball
- `arrow` - Arrow animations
- `hamburger` - Hamburger menu animation
- `growVertical` / `growHorizontal` - Growing bars
- `balloon` / `balloon2` - Balloon animations
- `noise` / `bounce` - Various effects
- `boxBounce` - Bouncing box
- `weather` - Weather icons
- `moon` - Moon phases
- `runner` - Running character
- `pong` - Pong animation
- `shark` - Shark animation
- `dqpb` - Letter rotation

See the full list at [cli-spinners](https://github.com/sindresorhus/cli-spinners#readme).

## Custom Spinners

Create your own spinner with custom frames:

```typescript
const spinner = new SpinnerRenderable(renderer, {
  frames: ["◐", "◓", "◑", "◒"],
  interval: 80,
  color: "magenta",
});
```

## Color Options

Colors can be specified in multiple formats:

```typescript
// Named colors
spinner.color = "red";
spinner.color = "cyan";

// RGB values
spinner.color = { r: 255, g: 100, b: 50 };

// Hex colors
spinner.color = "#ff6432";
```

## Examples

Check out the `examples/` directory for complete working examples:

- [`examples/index.ts`](examples/index.ts) - Core example
- [`examples/react.tsx`](examples/react.tsx) - React example
- [`examples/solid.tsx`](examples/solid.tsx) - SolidJS example

## Peer Dependencies

- `@opentui/core` (required)
- `@opentui/react` (optional, for React support)
- `@opentui/solid` (optional, for SolidJS support)

## Development

```bash
# Install dependencies
bun install

# Build the library
bun run build

# Lint code
bun run lint

# Auto-fix linting issues
bun run lint:fix
```

## License

MIT

## Credits

- Built on [OpenTUI](https://github.com/opentui/opentui)
- Spinners from [cli-spinners](https://github.com/sindresorhus/cli-spinners) by Sindre Sorhus

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
