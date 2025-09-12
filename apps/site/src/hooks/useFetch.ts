import { notification } from "antd";
import { useEffect, useState } from "react";

export interface UseFetchOptions<O, T> {
  params: O;
  default?: T;
  fetchFunction: (options: O) => Promise<T>;
  quiet?: boolean;
  watch?: any[];
  notifyOnError?: boolean;
  dataType?: string;
}

export const useFetch = <O, T>(
  options: UseFetchOptions<O, T>,
): [T, boolean, Error | undefined, (quiet: boolean) => Promise<void>] => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<T | undefined>(options.default);
  const [error, setError] = useState<Error | undefined>(undefined);

  const [api] = notification.useNotification();

  const fetcher = async (quietOverride = true) => {
    if (!options.quiet && !quietOverride) {
      setLoading(true);
    }
    setError(undefined);

    try {
      setData(await options.fetchFunction(options.params));
    } catch (e) {
      setError(e);

      api["error"]({
        message: "Unable to fetch data",
        description: `The ${options.dataType || "requested data"} could not be fetched`,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await fetcher();
    })();
  }, options.watch || []);

  return [data as T, loading, error, fetcher];
};
