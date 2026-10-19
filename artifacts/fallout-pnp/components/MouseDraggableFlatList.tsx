import React, { useMemo, useRef, useState } from 'react';
import {
  FlatList,
  PanResponder,
  Platform,
  View,
} from 'react-native';
import type {
  FlatListProps,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import {
  calculateMouseDragScrollOffset,
  shouldStartVerticalMouseDrag,
  shouldSuppressClickAfterMouseDrag,
} from '@/data/mouseDragScroll';

/**
 * Keeps native touch and browser wheel scrolling intact, and adds grab-to-scroll
 * for mouse users in the web preview.
 */
export function MouseDraggableFlatList<ItemT>(props: FlatListProps<ItemT>) {
  const listRef = useRef<FlatList<ItemT> | null>(null);
  const metrics = useRef({ offset: 0, contentHeight: 0, viewportHeight: 0 });
  const dragStartOffset = useRef(0);
  const dragEndedAt = useRef(0);
  const [dragging, setDragging] = useState(false);

  const handleClickCapture = (event: {
    preventDefault: () => void;
    stopPropagation: () => void;
  }) => {
    if (!shouldSuppressClickAfterMouseDrag(dragEndedAt.current, Date.now())) return;
    dragEndedAt.current = 0;
    event.preventDefault();
    event.stopPropagation();
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    metrics.current.offset = Math.max(0, event.nativeEvent.contentOffset.y);
    props.onScroll?.(event);
  };

  const handleLayout = (event: LayoutChangeEvent) => {
    metrics.current.viewportHeight = event.nativeEvent.layout.height;
    props.onLayout?.(event);
  };

  const handleContentSizeChange = (width: number, height: number) => {
    metrics.current.contentHeight = height;
    props.onContentSizeChange?.(width, height);
  };

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onStartShouldSetPanResponderCapture: () => false,
    onMoveShouldSetPanResponder: (_event, gesture) =>
      Platform.OS === 'web'
      && shouldStartVerticalMouseDrag(gesture.dx, gesture.dy),
    onMoveShouldSetPanResponderCapture: (_event, gesture) =>
      Platform.OS === 'web'
      && shouldStartVerticalMouseDrag(gesture.dx, gesture.dy),
    onPanResponderGrant: () => {
      dragStartOffset.current = metrics.current.offset;
      setDragging(true);
    },
    onPanResponderMove: (_event, gesture) => {
      const offset = calculateMouseDragScrollOffset(
        dragStartOffset.current,
        gesture.dy,
        metrics.current.viewportHeight,
        metrics.current.contentHeight,
      );
      listRef.current?.scrollToOffset({ offset, animated: false });
    },
    onPanResponderRelease: () => {
      dragEndedAt.current = Date.now();
      setDragging(false);
    },
    onPanResponderTerminate: () => {
      dragEndedAt.current = Date.now();
      setDragging(false);
    },
    onPanResponderTerminationRequest: () => false,
  }), []);

  return (
    <View
      {...panResponder.panHandlers}
      {...(Platform.OS === 'web' ? { onClickCapture: handleClickCapture } as any : {})}
      style={[
        { flex: 1 },
        Platform.OS === 'web' && { cursor: dragging ? 'grabbing' : 'grab' } as any,
      ]}
    >
      <FlatList
        {...props}
        ref={listRef}
        onScroll={handleScroll}
        onLayout={handleLayout}
        onContentSizeChange={handleContentSizeChange}
        scrollEventThrottle={16}
        accessibilityHint={props.accessibilityHint ?? 'Scroll with the wheel or drag with a mouse.'}
      />
    </View>
  );
}
