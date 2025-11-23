import {
  BoxRenderable,
  type ColorInput,
  createCliRenderer,
  engine,
  RGBA,
} from "@opentui/core";
import { SpinnerRenderable } from "../src/index";

const renderer = await createCliRenderer();
renderer.setBackgroundColor("#000000");
engine.attach(renderer);

const container = new BoxRenderable(renderer, {
  paddingTop: 2,
  paddingLeft: 4,
});
renderer.root.add(container);

// Custom Color Generator types and function for Knight Rider effect
type ColorGenerator = (
  frameIndex: number,
  charIndex: number,
  totalFrames: number,
  totalChars: number,
) => ColorInput;

interface AdvancedGradientOptions {
  colors: ColorInput[];
  trailLength: number;
  defaultColor?: ColorInput;
  direction?: "forward" | "backward" | "bidirectional";
  holdFrames?: { start?: number; end?: number };
}

interface ScannerState {
  activePosition: number;
  isHolding: boolean;
  holdProgress: number;
  holdTotal: number;
  movementProgress: number;
  movementTotal: number;
  isMovingForward: boolean;
}

function getScannerState(
  frameIndex: number,
  totalChars: number,
  options: Pick<AdvancedGradientOptions, "direction" | "holdFrames">,
): ScannerState {
  const { direction = "forward", holdFrames = {} } = options;

  if (direction === "bidirectional") {
    const forwardFrames = totalChars;
    const holdEndFrames = holdFrames.end ?? 0;
    const backwardFrames = totalChars - 1;

    if (frameIndex < forwardFrames) {
      // Moving forward
      return {
        activePosition: frameIndex,
        isHolding: false,
        holdProgress: 0,
        holdTotal: 0,
        movementProgress: frameIndex,
        movementTotal: forwardFrames,
        isMovingForward: true,
      };
    } else if (frameIndex < forwardFrames + holdEndFrames) {
      // Holding at end
      return {
        activePosition: totalChars - 1,
        isHolding: true,
        holdProgress: frameIndex - forwardFrames,
        holdTotal: holdEndFrames,
        movementProgress: 0,
        movementTotal: 0,
        isMovingForward: true,
      };
    } else if (frameIndex < forwardFrames + holdEndFrames + backwardFrames) {
      // Moving backward
      const backwardIndex = frameIndex - forwardFrames - holdEndFrames;
      return {
        activePosition: totalChars - 2 - backwardIndex,
        isHolding: false,
        holdProgress: 0,
        holdTotal: 0,
        movementProgress: backwardIndex,
        movementTotal: backwardFrames,
        isMovingForward: false,
      };
    } else {
      // Holding at start
      return {
        activePosition: 0,
        isHolding: true,
        holdProgress:
          frameIndex - forwardFrames - holdEndFrames - backwardFrames,
        holdTotal: holdFrames.start ?? 0,
        movementProgress: 0,
        movementTotal: 0,
        isMovingForward: false,
      };
    }
  } else if (direction === "backward") {
    return {
      activePosition: totalChars - 1 - (frameIndex % totalChars),
      isHolding: false,
      holdProgress: 0,
      holdTotal: 0,
      movementProgress: frameIndex % totalChars,
      movementTotal: totalChars,
      isMovingForward: false,
    };
  } else {
    return {
      activePosition: frameIndex % totalChars,
      isHolding: false,
      holdProgress: 0,
      holdTotal: 0,
      movementProgress: frameIndex % totalChars,
      movementTotal: totalChars,
      isMovingForward: true,
    };
  }
}

function calculateColorIndex(
  frameIndex: number,
  charIndex: number,
  totalChars: number,
  options: Pick<
    AdvancedGradientOptions,
    "direction" | "holdFrames" | "trailLength"
  >,
): number {
  const { trailLength } = options;
  const { activePosition, isHolding, holdProgress, isMovingForward } =
    getScannerState(frameIndex, totalChars, options);

  // Calculate directional distance (positive means trailing behind)
  const directionalDistance = isMovingForward
    ? activePosition - charIndex // For forward: trail is to the left (lower indices)
    : charIndex - activePosition; // For backward: trail is to the right (higher indices)

  // Handle hold frame fading: keep the lead bright, fade the trail
  if (isHolding) {
    // Shift the color index by how long we've been holding
    return directionalDistance + holdProgress;
  }

  // Normal movement - show gradient trail only behind the movement direction
  if (directionalDistance > 0 && directionalDistance < trailLength) {
    return directionalDistance;
  }

  // At the active position, show the brightest color
  if (directionalDistance === 0) {
    return 0;
  }

  return -1;
}

function createKnightRiderTrail(
  options: AdvancedGradientOptions,
): ColorGenerator {
  const { colors, defaultColor } = options;

  // Use the provided defaultColor if it's an RGBA instance, otherwise convert/default
  // We use RGBA.fromHex for the fallback to ensure we have an RGBA object.
  // Note: If defaultColor is a string, we convert it once here.
  const defaultRgba =
    defaultColor instanceof RGBA
      ? defaultColor
      : RGBA.fromHex((defaultColor as string) || "#000000");

  return (
    frameIndex: number,
    charIndex: number,
    _totalFrames: number,
    totalChars: number,
  ) => {
    const index = calculateColorIndex(
      frameIndex,
      charIndex,
      totalChars,
      options,
    );

    // Calculate global fade for inactive dots during hold or movement
    const {
      isHolding,
      holdProgress,
      holdTotal,
      movementProgress,
      movementTotal,
    } = getScannerState(frameIndex, totalChars, options);

    let alpha = 1.0;
    if (isHolding && holdTotal > 0) {
      // Fade out linearly
      const progress = Math.min(holdProgress / holdTotal, 1);
      alpha = Math.max(0, 1 - progress);
    } else if (!isHolding && movementTotal > 0) {
      // Fade in linearly during movement
      const progress = Math.min(
        movementProgress / Math.max(1, movementTotal - 1),
        1,
      );
      alpha = progress;
    }

    // Mutate the alpha of the default RGBA object
    // This assumes single-threaded, synchronous rendering per frame
    // where we can modify the state for the current frame.
    // Since this is run for every char in the frame, setting it repeatedly to the same value is fine.
    defaultRgba.a = alpha;

    if (index === -1) {
      return defaultRgba;
    }

    return colors[index] ?? defaultRgba;
  };
}

// Configuration for the Knight Rider scanner
type KnightRiderStyle = "blocks" | "diamonds";

interface KnightRiderOptions {
  width?: number;
  style?: KnightRiderStyle;
}

function createKnightRiderSpinner(
  renderer: Awaited<ReturnType<typeof createCliRenderer>>,
  options: KnightRiderOptions = {},
) {
  const width = options.width ?? 8;
  const style = options.style ?? "diamonds";

  // Cycle definition
  const holdStart = 30;
  const holdEnd = 9;
  // Bidirectional cycle: Forward (width) + Hold End + Backward (width-1) + Hold Start
  const totalFrames = width + holdEnd + (width - 1) + holdStart;

  const trailOptions = {
    colors: [
      RGBA.fromHex("#ff0000"), // Brightest Red (Center)
      RGBA.fromHex("#ff5555"), // Glare/Bloom
      RGBA.fromHex("#dd0000"), // Trail 1
      RGBA.fromHex("#aa0000"), // Trail 2
      RGBA.fromHex("#770000"), // Trail 3
      RGBA.fromHex("#440000"), // Trail 4
    ],
    trailLength: 6,
    defaultColor: RGBA.fromHex("#330000"), // Unlit segments (dark red)
    direction: "bidirectional" as const,
    holdFrames: { start: holdStart, end: holdEnd },
  };

  // Generate dynamic frames where inactive pixels are dots and active ones are blocks
  const frames = Array.from({ length: totalFrames }, (_, frameIndex) => {
    return Array.from({ length: width }, (_, charIndex) => {
      const index = calculateColorIndex(
        frameIndex,
        charIndex,
        width,
        trailOptions,
      );

      if (style === "diamonds") {
        const shapes = ["⬥", "◆", "⬩", "⬪"];
        if (index >= 0 && index < trailOptions.colors.length) {
          return shapes[Math.min(index, shapes.length - 1)];
        }
        return "·";
      }

      // Default to blocks
      // It's active if we have a valid color index that is within our colors array
      const isActive = index >= 0 && index < trailOptions.colors.length;
      return isActive ? "■" : "⬝";
    }).join("");
  });

  return new SpinnerRenderable(renderer, {
    frames,
    interval: 40, // Slightly slower for "burst" effect
    color: createKnightRiderTrail(trailOptions),
  });
}

const spinner = createKnightRiderSpinner(renderer, {
  style: "diamonds",
});

container.add(spinner);
