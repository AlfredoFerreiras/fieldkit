import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

/**
 * The current time as render input. Screens that bucket records by week need
 * "now", but reading the clock during render is impure and the compiler
 * rightly objects. This captures it once and refreshes each time the screen
 * regains focus, which is also when the records themselves are reloaded.
 */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useFocusEffect(
    useCallback(() => {
      setNow(Date.now());
    }, []),
  );
  return now;
}
