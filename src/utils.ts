// ============================================================================
// Color Generator Types & Functions
// ============================================================================

import type { ColorInput } from "@opentui/core";

/**
 * Function that generates a color for a specific character at a specific frame
 * @param frameIndex - Current frame index (0 to totalFrames-1)
 * @param charIndex - Current character index (0 to totalChars-1)
 * @param totalFrames - Total number of frames in the animation
 * @param totalChars - Total number of characters in the current frame
 * @returns Color for this specific character at this specific frame
 */
export type ColorGenerator = (
  frameIndex: number,
  charIndex: number,
  totalFrames: number,
  totalChars: number,
) => ColorInput;

/**
 * Options for creating a gradient trail effect
 */
export interface ColorGradientOptions {
  /** Gradient colors from brightest to darkest */
  colors: ColorInput[];
  /** How many positions show the gradient trail */
  trailLength: number;
  /** Color for inactive positions (default: "transparent") */
  defaultColor?: ColorInput;
}

/**
 * Advanced options for creating bidirectional gradient trails with hold frames
 */
export interface AdvancedGradientOptions extends ColorGradientOptions {
  /** Direction of movement */
  direction?: "forward" | "backward" | "bidirectional";
  /** Number of frames to hold at start and/or end positions */
  holdFrames?: { start?: number; end?: number };
}

/**
 * Creates a gradient trail effect that follows the spinner position
 * @example
 * ```typescript
 * const colorGen = createGradientTrail({
 *   colors: ["#f5a742", "#ec8b0d", "#b16809", "#764506", "#593405"],
 *   trailLength: 5,
 *   defaultColor: "#323232",
 *   direction: 'bidirectional',
 *   holdFrames: { start: 3, end: 4 }
 * });
 * ```
 */
export function createGradientTrail(
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
      // Calculate how many positions are still visible (including head)
      // When holding, we simulate the scanner continuing to move off-screen/fading out
      const visibleLength = Math.max(0, trailLength - holdFrameProgress);

      // Only show trail behind the movement direction if it's within the visible length
      if (directionalDistance >= 0 && directionalDistance < visibleLength) {
        return colors[directionalDistance] ?? defaultColor;
      }

      return defaultColor;
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

/**
 * Creates a pulsing color effect that cycles through colors
 * @example
 * ```typescript
 * const colorGen = createPulse(["red", "orange", "yellow"], 0.5);
 * ```
 */
export function createPulse(colors: ColorInput[], speed = 1.0): ColorGenerator {
  return (frameIndex: number) => {
    const adjustedFrame = Math.floor(frameIndex * speed);
    const colorIndex = adjustedFrame % colors.length;
    return colors[colorIndex];
  };
}

/**
 * Creates a wave pattern that moves across characters
 * @example
 * ```typescript
 * const colorGen = createWave(["#ff0000", "#00ff00", "#0000ff"]);
 * ```
 */
export function createWave(colors: ColorInput[]): ColorGenerator {
  return (
    frameIndex: number,
    charIndex: number,
    _totalFrames: number,
    totalChars: number,
  ) => {
    const position = (charIndex + frameIndex) % totalChars;
    const colorIndex = Math.floor((position / totalChars) * colors.length);
    return colors[colorIndex] ?? colors[0];
  };
}
