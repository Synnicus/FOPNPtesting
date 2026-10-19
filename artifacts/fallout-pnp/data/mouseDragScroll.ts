export const MOUSE_DRAG_THRESHOLD = 6;
export const MOUSE_DRAG_CLICK_SUPPRESSION_MS = 350;

/** Convert a mouse drag delta into a clamped vertical list offset. */
export function calculateMouseDragScrollOffset(
  startOffset: number,
  dragDeltaY: number,
  viewportHeight: number,
  contentHeight: number,
): number {
  const maximumOffset = Math.max(0, contentHeight - viewportHeight);
  return Math.max(0, Math.min(maximumOffset, startOffset - dragDeltaY));
}

/** Recognize intentional vertical mouse scrolling, not a click or horizontal gesture. */
export function shouldStartVerticalMouseDrag(deltaX: number, deltaY: number): boolean {
  return Math.abs(deltaY) > MOUSE_DRAG_THRESHOLD && Math.abs(deltaY) > Math.abs(deltaX);
}

/** Limit click suppression to the synthetic click immediately following a completed drag. */
export function shouldSuppressClickAfterMouseDrag(dragEndedAt: number, now: number): boolean {
  const elapsed = now - dragEndedAt;
  return dragEndedAt > 0 && elapsed >= 0 && elapsed <= MOUSE_DRAG_CLICK_SUPPRESSION_MS;
}
