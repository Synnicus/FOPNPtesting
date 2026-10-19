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
import { calculateMouseDragScrollOffset } from '@/data/mouseDragScroll';

const DRAG_THRESHOLD = 6;

/**
 * Keeps native touch and browser wheel scrolling intact, and adds grab-to-scroll
 * for mouse users in the web preview.
 */
export function MouseDraggableFlatList<ItemT>(props: FlatListProps<ItemT>) {
  const listRef = useRef<FlatList<ItemT> | null>(null);
  const metrics = useRef({ offset: 0, contentHeight: 0, viewportHeight: 0 });
  const dragStartOffset = useRef(0);
  const [dragging, setDragging] = useState(false);

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
      && Math.abs(gesture.dy) > DRAG_THRESHOLD
      && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onMoveShouldSetPanResponderCapture: (_event, gesture) =>
      Platform.OS === 'web'
      && Math.abs(gesture.dy) > DRAG_THRESHOLD
      && Math.abs(gesture.dy) > Math.abs(gesture.dx),
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
    onPanResponderRelease: () => setDragging(false),
    onPanResponderTerminate: () => setDragging(false),
    onPanResponderTerminationRequest: () => false,
  }), []);

  return (
    <View
      {...panResponder.panHandlers}
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
