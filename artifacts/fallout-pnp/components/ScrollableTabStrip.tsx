import React, { useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  PanResponder,
  Platform,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';

type ScrollableTabStripColors = {
  background: string;
  border: string;
  mutedForeground: string;
  primary: string;
  radius: number;
};

type Props = {
  children: ReactNode;
  colors: ScrollableTabStripColors;
  contentContainerStyle?: StyleProp<ViewStyle>;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
};

const DRAG_THRESHOLD = 6;
const ARROW_SIZE = 30;

export function ScrollableTabStrip({
  children,
  colors,
  contentContainerStyle,
  accessibilityLabel,
  style,
}: Props) {
  const testIdPrefix = accessibilityLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const scrollRef = useRef<ScrollView>(null);
  const metrics = useRef({ offset: 0, contentWidth: 0, viewportWidth: 0 });
  const dragStartOffset = useRef(0);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateIndicators = (offset: number) => {
    const { contentWidth, viewportWidth } = metrics.current;
    const overflow = viewportWidth > 0 && contentWidth > viewportWidth + 2;
    setHasOverflow(overflow);
    setCanScrollLeft(overflow && offset > 2);
    setCanScrollRight(overflow && offset + viewportWidth < contentWidth - 2);
  };

  const handleLayout = (event: LayoutChangeEvent) => {
    metrics.current.viewportWidth = event.nativeEvent.layout.width;
    updateIndicators(metrics.current.offset);
  };

  const handleContentSizeChange = (width: number) => {
    metrics.current.contentWidth = width;
    updateIndicators(metrics.current.offset);
  };

  const handleScroll = (event: {
    nativeEvent: { contentOffset: { x: number } };
  }) => {
    const offset = Math.max(0, event.nativeEvent.contentOffset.x);
    metrics.current.offset = offset;
    updateIndicators(offset);
  };

  const scrollByPage = (direction: -1 | 1) => {
    const { offset, contentWidth, viewportWidth } = metrics.current;
    const maxOffset = Math.max(0, contentWidth - viewportWidth);
    const nextOffset = Math.max(
      0,
      Math.min(maxOffset, offset + direction * Math.max(100, viewportWidth * 0.72)),
    );
    scrollRef.current?.scrollTo({ x: nextOffset, animated: true });
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Platform.OS === 'web'
          && Math.abs(gesture.dx) > DRAG_THRESHOLD
          && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onMoveShouldSetPanResponderCapture: (_event, gesture) =>
          Platform.OS === 'web'
          && Math.abs(gesture.dx) > DRAG_THRESHOLD
          && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderGrant: () => {
          dragStartOffset.current = metrics.current.offset;
        },
        onPanResponderMove: (_event, gesture) => {
          const maxOffset = Math.max(
            0,
            metrics.current.contentWidth - metrics.current.viewportWidth,
          );
          const nextOffset = Math.max(
            0,
            Math.min(maxOffset, dragStartOffset.current - gesture.dx),
          );
          scrollRef.current?.scrollTo({ x: nextOffset, animated: false });
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [],
  );

  return (
    <View
      {...panResponder.panHandlers}
      accessibilityLabel={accessibilityLabel}
      style={[
        { width: '100%', flexGrow: 0, flexDirection: 'row', alignItems: 'center' },
        style,
      ]}
    >
      {hasOverflow && canScrollLeft ? (
        <TouchableOpacity
          testID={`${testIdPrefix}-scroll-left`}
          accessibilityRole="button"
          accessibilityLabel="Scroll tabs left"
          onPress={() => scrollByPage(-1)}
          style={{
            width: ARROW_SIZE,
            height: 34,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: colors.radius,
            backgroundColor: colors.background,
            marginRight: 4,
          }}
        >
          <Feather
            name="chevron-left"
            size={17}
            color={colors.primary}
          />
        </TouchableOpacity>
      ) : null}

      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onLayout={handleLayout}
        onContentSizeChange={handleContentSizeChange}
        onScroll={handleScroll}
        contentContainerStyle={contentContainerStyle}
        style={{ flex: 1, minWidth: 0 }}
        accessibilityRole="tablist"
        accessibilityHint="Swipe or drag horizontally, or use the arrow buttons to see more tabs."
      >
        {children}
      </ScrollView>

      {hasOverflow && canScrollRight ? (
        <TouchableOpacity
          testID={`${testIdPrefix}-scroll-right`}
          accessibilityRole="button"
          accessibilityLabel="Scroll tabs right"
          onPress={() => scrollByPage(1)}
          style={{
            width: ARROW_SIZE,
            height: 34,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: colors.radius,
            backgroundColor: colors.background,
            marginLeft: 4,
          }}
        >
          <Feather
            name="chevron-right"
            size={17}
            color={colors.primary}
          />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
