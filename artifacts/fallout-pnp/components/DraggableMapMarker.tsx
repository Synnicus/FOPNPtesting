import React, { useRef } from 'react';
import { PanResponder, View } from 'react-native';
import { LocalizedTouchableOpacity as TouchableOpacity } from '@/components/LocalizedText';
import type { CampaignMapMarker } from '@/context/types';
import { moveMapMarker, type MapSize } from '@/data/mapPlacement';
import { useColors } from '@/hooks/useColors';

export default function DraggableMapMarker({
  marker, artboard, zoom, editable, onMove, onPress, children,
}: {
  marker: CampaignMapMarker;
  artboard: MapSize;
  zoom: number;
  editable: boolean;
  onMove: (point: { x: number; y: number }) => void;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const colors = useColors();
  const latest = useRef({ marker, artboard, zoom, editable, onMove });
  latest.current = { marker, artboard, zoom, editable, onMove };
  const start = useRef({ x: marker.x, y: marker.y });
  const dragged = useRef(false);
  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => latest.current.editable,
    onStartShouldSetPanResponderCapture: () => latest.current.editable,
    onMoveShouldSetPanResponder: () => latest.current.editable,
    onPanResponderGrant: () => {
      start.current = { x: latest.current.marker.x, y: latest.current.marker.y };
      dragged.current = false;
    },
    onPanResponderMove: (_event, gesture) => {
      if (!latest.current.editable) return;
      dragged.current = true;
      latest.current.onMove(moveMapMarker(
        start.current, { x: gesture.dx, y: gesture.dy }, latest.current.artboard, latest.current.zoom,
      ));
    },
    onPanResponderRelease: () => { dragged.current = false; },
    onPanResponderTerminationRequest: () => false,
  })).current;

  return (
    <View
      {...responder.panHandlers}
      testID={editable ? 'staged-map-marker' : `map-marker-${marker.id}`}
      style={{
        position: 'absolute', left: marker.x * artboard.width, top: marker.y * artboard.height,
        width: 44, height: 44, marginLeft: -22, marginTop: -38,
        zIndex: editable ? 2 : 1,
        ...(editable ? { cursor: 'move', touchAction: 'none' } as object : {}),
      }}
    >
      <TouchableOpacity
        accessibilityLabel={marker.name || 'New location'}
        onPress={event => { event.stopPropagation(); if (!dragged.current) onPress(); }}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
      >
        <View style={{
          width: 28, height: 28, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
          backgroundColor: colors.background, borderWidth: editable ? 3 : 1.5,
          borderColor: editable ? colors.warning : colors.primary,
        }}>
          {children}
        </View>
        <View style={{
          position: 'absolute', bottom: 1, width: 0, height: 0,
          borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 7,
          borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: colors.primary,
        }} />
      </TouchableOpacity>
    </View>
  );
}
