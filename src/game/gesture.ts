/** A pointer that moved more than `threshold` px is a drag; otherwise it is a tap. */
export const isDrag = (dx: number, dy: number, threshold = 10) => Math.hypot(dx, dy) > threshold;
