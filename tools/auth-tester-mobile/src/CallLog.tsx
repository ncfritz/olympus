import { useMemo, useState } from "react";
import { Animated, PanResponder, Pressable, Text, View } from "react-native";
import type { Logged } from "./called";
import { styles } from "./styles";

/** Far enough off any screen, and short enough not to be a wait. */
const AWAY = 500;
const DISMISS = 80;

/**
 * One call, swipeable away and tappable shorter.
 *
 * Both exist because of the same afternoon: an error from the native module can
 * be several lines of Foundation prose, and it is the only account of a refused
 * handshake there is -- so it cannot be truncated, and a screen of them cannot
 * be unclearable.
 */
const Row = ({ called, onClear }: { called: Logged; onClear: () => void }) => {
  // State rather than a ref: an Animated.Value has to survive every render and
  // is never read while rendering, which is exactly what a ref may not be used
  // for. `useState` with an initializer makes it once and holds it.
  const [shift] = useState(() => new Animated.Value(0));
  const [short, setShort] = useState(false);

  // Rebuilt when the callback changes, which is when the log changes and never
  // while a finger is down.
  const pan = useMemo(
    () =>
      PanResponder.create({
        // Only a mostly-horizontal drag. The log is inside a vertical
        // ScrollView, and claiming a vertical gesture would stop the screen
        // scrolling wherever a row happened to be under the finger.
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dx) > 8 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy) * 2,
        onPanResponderMove: (_event, gesture) => {
          shift.setValue(Math.min(0, gesture.dx));
        },
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dx < -DISMISS) {
            Animated.timing(shift, {
              toValue: -AWAY,
              duration: 140,
              useNativeDriver: true,
            }).start(onClear);
            return;
          }
          Animated.spring(shift, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(shift, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        },
      }),
    [shift, onClear],
  );

  return (
    <Animated.View
      style={[styles.called, { transform: [{ translateX: shift }] }]}
      {...pan.panHandlers}
    >
      <Pressable onPress={() => setShort((was) => !was)}>
        <Text style={styles.calledHead}>
          {called.method} {called.path} · {called.status ?? "—"} · {called.took}
          ms
        </Text>
        <Text
          style={styles.calledBody}
          {...(short ? { numberOfLines: 2 } : {})}
        >
          {called.answer}
        </Text>
      </Pressable>
    </Animated.View>
  );
};

/**
 * The log: newest first, every line of every answer, swipe left to remove one.
 */
export const CallLog = ({
  entries,
  onClear,
}: {
  entries: Logged[];
  onClear: (id: number) => void;
}) => (
  <View>
    {entries.map((called) => (
      <Row key={called.id} called={called} onClear={() => onClear(called.id)} />
    ))}
    {entries.length > 1 && (
      <Text style={styles.note}>
        Swipe a line left to remove it; tap one to shorten it.
      </Text>
    )}
  </View>
);
