import React, { useRef, useState } from 'react';
import { Modal, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { color, radius, space, TOUCH, type } from './theme';

/** Stored as a JSON string so it survives the record payload untouched:
 *  { w, h, paths: ["M 12 40 L 14 42 ...", ...] } in pad coordinates. */
export interface SignatureData {
  w: number;
  h: number;
  paths: string[];
}

export function parseSignature(value: unknown): SignatureData | null {
  if (typeof value !== 'string' || value === '') return null;
  try {
    const parsed = JSON.parse(value) as SignatureData;
    return Array.isArray(parsed.paths) && parsed.paths.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

interface Props {
  label: string;
  value: unknown;
  onChange: (value: unknown) => void;
  signHereText: string;
  clearText: string;
  doneText: string;
  cancelText: string;
}

export function SignaturePad({
  label,
  value,
  onChange,
  signHereText,
  clearText,
  doneText,
  cancelText,
}: Props) {
  const [open, setOpen] = useState(false);
  const signature = parseSignature(value);

  return (
    <View>
      <Pressable
        style={[styles.preview, signature && styles.previewSigned]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        {signature ? (
          <Svg
            width="100%"
            height={96}
            viewBox={`0 0 ${signature.w} ${signature.h}`}
            preserveAspectRatio="xMidYMid meet"
          >
            {signature.paths.map((d, i) => (
              <Path key={i} d={d} stroke={color.ink} strokeWidth={3} fill="none" />
            ))}
          </Svg>
        ) : (
          <Text style={styles.previewText}>{signHereText}</Text>
        )}
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <DrawSurface
          label={label}
          initial={signature}
          clearText={clearText}
          doneText={doneText}
          cancelText={cancelText}
          onCancel={() => setOpen(false)}
          onDone={(data) => {
            onChange(data ? JSON.stringify(data) : undefined);
            setOpen(false);
          }}
        />
      </Modal>
    </View>
  );
}

function DrawSurface({
  label,
  initial,
  clearText,
  doneText,
  cancelText,
  onCancel,
  onDone,
}: {
  label: string;
  initial: SignatureData | null;
  clearText: string;
  doneText: string;
  cancelText: string;
  onCancel: () => void;
  onDone: (data: SignatureData | null) => void;
}) {
  const [paths, setPaths] = useState<string[]>(initial?.paths ?? []);
  const [livePath, setLivePath] = useState<string | null>(null);
  const size = useRef({ w: initial?.w ?? 1, h: initial?.h ?? 1 });
  const current = useRef('');

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        current.current = `M ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
        setLivePath(current.current);
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        current.current += ` L ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
        setLivePath(current.current);
      },
      onPanResponderRelease: () => {
        // A tap with no movement draws a dot rather than vanishing.
        const finished = current.current.includes('L')
          ? current.current
          : `${current.current} l 0.1 0.1`;
        setPaths((prev) => [...prev, finished]);
        setLivePath(null);
        current.current = '';
      },
    }),
  ).current;

  return (
    <View style={styles.surface}>
      <Text style={styles.surfaceTitle}>{label}</Text>

      <View
        style={styles.canvas}
        onLayout={(e) => {
          size.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height };
        }}
        {...responder.panHandlers}
      >
        <Svg width="100%" height="100%">
          {paths.map((d, i) => (
            <Path key={i} d={d} stroke={color.ink} strokeWidth={3} fill="none" />
          ))}
          {livePath ? <Path d={livePath} stroke={color.ink} strokeWidth={3} fill="none" /> : null}
        </Svg>
        <View style={styles.baseline} pointerEvents="none" />
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.ghost} onPress={() => setPaths([])}>
          <Text style={styles.ghostText}>{clearText}</Text>
        </Pressable>
        <Pressable style={styles.ghost} onPress={onCancel}>
          <Text style={styles.ghostText}>{cancelText}</Text>
        </Pressable>
        <Pressable
          style={styles.confirm}
          onPress={() =>
            onDone(
              paths.length > 0 ? { w: size.current.w, h: size.current.h, paths } : null,
            )
          }
        >
          <Text style={styles.confirmText}>{doneText}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  preview: {
    minHeight: TOUCH * 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: color.inkFaint,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    padding: space.sm,
  },
  previewSigned: { borderStyle: 'solid', borderColor: color.line },
  previewText: { ...type.body, color: color.inkMuted },

  surface: { flex: 1, backgroundColor: color.canvas, padding: space.lg, gap: space.lg },
  surfaceTitle: { ...type.title, fontSize: 22, color: color.ink, marginTop: space.xl },
  canvas: {
    flex: 1,
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.line,
    overflow: 'hidden',
  },
  baseline: {
    position: 'absolute',
    left: space.xl,
    right: space.xl,
    bottom: '25%',
    height: 1,
    backgroundColor: color.line,
  },

  actions: { flexDirection: 'row', gap: space.md, marginBottom: space.xl },
  ghost: {
    flex: 1,
    minHeight: TOUCH,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: color.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostText: { ...type.label, color: color.ink },
  confirm: {
    flex: 2,
    minHeight: TOUCH,
    borderRadius: radius.md,
    backgroundColor: color.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: { ...type.label, fontSize: 19, color: color.surface },
});
