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
