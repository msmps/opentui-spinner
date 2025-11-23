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
