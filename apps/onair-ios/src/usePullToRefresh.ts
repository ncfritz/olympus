import { useCallback, useState } from "react";

/**
 * Pull to refresh for a scroll view's RefreshControl: shows the spinner
 * until the reload settles, so a pull feels like it did something.
 */
export const usePullToRefresh = (reload: () => Promise<void>) => {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void reload().finally(() => setRefreshing(false));
  }, [reload]);
  return { refreshing, onRefresh };
};
