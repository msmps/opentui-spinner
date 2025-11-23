import {
  BoxRenderable,
  type ColorInput,
  createCliRenderer,
  engine,
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

function createKnightRiderTrail(
  options: AdvancedGradientOptions,
): ColorGenerator {
  const {
    colors,
    trailLength,
    defaultColor = "transparent",
    direction = "forward",
    holdFrames = {},
  } = options;

  return (
    frameIndex: number,
    charIndex: number,
    _totalFrames: number,
    totalChars: number,
  ) => {
    let activePosition: number;
    let isHoldingAtEnd = false;
    let isHoldingAtStart = false;
    let holdFrameProgress = 0; // 0 to holdFrames count
    let isMovingForward = true; // Track direction of movement

    if (direction === "bidirectional") {
      // Calculate effective position accounting for hold frames and bidirectional movement
      const forwardFrames = totalChars;
      const holdEndFrames = holdFrames.end ?? 0;
      const backwardFrames = totalChars - 1; // -1 because we skip the end position we held at

      if (frameIndex < forwardFrames) {
        // Moving forward
        activePosition = frameIndex;
        isMovingForward = true;
      } else if (frameIndex < forwardFrames + holdEndFrames) {
        // Holding at end - trail colors fade away
        activePosition = totalChars - 1;
        isHoldingAtEnd = true;
        isMovingForward = true;
        holdFrameProgress = frameIndex - forwardFrames;
      } else if (frameIndex < forwardFrames + holdEndFrames + backwardFrames) {
        // Moving backward
        const backwardIndex = frameIndex - forwardFrames - holdEndFrames;
        activePosition = totalChars - 2 - backwardIndex; // -2 to skip the end position we held at
        isMovingForward = false;
      } else {
        // Holding at start - trail colors fade away
        activePosition = 0;
        isHoldingAtStart = true;
        isMovingForward = false;
        holdFrameProgress =
          frameIndex - forwardFrames - holdEndFrames - backwardFrames;
      }
    } else if (direction === "backward") {
      activePosition = totalChars - 1 - (frameIndex % totalChars);
      isMovingForward = false;
    } else {
      activePosition = frameIndex % totalChars;
      isMovingForward = true;
    }

    // Calculate directional distance (positive means trailing behind)
    const directionalDistance = isMovingForward
      ? activePosition - charIndex // For forward: trail is to the left (lower indices)
      : charIndex - activePosition; // For backward: trail is to the right (higher indices)

    // Handle hold frame fading: keep the lead bright, fade the trail
    if (isHoldingAtEnd || isHoldingAtStart) {
      // Shift the color index by how long we've been holding
      // This makes the active pixels fade through the trail colors
      const fadedIndex = directionalDistance + holdFrameProgress;
      return colors[fadedIndex] ?? defaultColor;
    }

    // Normal movement - show gradient trail only behind the movement direction
    if (directionalDistance > 0 && directionalDistance < trailLength) {
      return colors[directionalDistance] ?? defaultColor;
    }

    // At the active position, show the brightest color
    if (directionalDistance === 0) {
      return colors[0];
    }

    return defaultColor;
  };
}

// Configuration for the Knight Rider scanner
const width = 10;
const char = "■"; // Block character simulating an LED segment
const pattern = char.repeat(width);

// Cycle definition
const holdStart = 25;
const holdEnd = 6;
// Bidirectional cycle: Forward (width) + Hold End + Backward (width-1) + Hold Start
const totalFrames = width + holdEnd + (width - 1) + holdStart;

// For this effect, the characters themselves don't move, only their colors change.
// So we repeat the same static pattern for every frame.
const frames = Array(totalFrames).fill(pattern);

const spinner = new SpinnerRenderable(renderer, {
  frames,
  interval: 40, // Slightly slower for "burst" effect
  color: createKnightRiderTrail({
    colors: [
      "#ff0000", // Brightest Red (Center)
      "#ff3333", // Glare/Bloom
      "#cc0000", // Trail 1
      "#990000", // Trail 2
      "#660000", // Trail 3
      "#330000", // Trail 4
    ],
    trailLength: 6,
    defaultColor: "#1a1a1a", // Unlit segments (dark gray)
    direction: "bidirectional",
    holdFrames: { start: holdStart, end: holdEnd },
  }),
});

container.add(spinner);
