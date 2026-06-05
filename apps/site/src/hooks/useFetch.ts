import { notification } from "antd";
import { useEffect, useState } from "react";

export interface UseFetchOptions<O, T> {
  params: O;
  default?: T;
  fetchFunction: (options: O) => Promise<T>;
  validateOptions?: (options: O) => boolean;
  quiet?: boolean;
  watch?: any[];
  notifyOnError?: boolean;
  dataType?: string;
  noWatch?: boolean;
  beforeDataRequest?: (params: O) => Promise<void>;
  onDataFetched?: (data: T) => Promise<void>;
}

export const useFetch = <O, T>(
  options: UseFetchOptions<O, T>,
): [
  T,
  boolean,
  Error | undefined,
  (quiet: boolean) => Promise<void>,
  (value: T) => void,
] => {
  const [loading, setLoading] = useState(!options.noWatch);
  const [data, setData] = useState<T | undefined>(options.default);
  const [error, setError] = useState<Error | undefined>(undefined);

  const fetcher = async (quietOverride = true) => {
    if (!options.quiet && !quietOverride) {
      setLoading(true);
    }
    setError(undefined);

    try {
      const data = await options.fetchFunction(options.params);

      setData(data);

      if (options.onDataFetched) {
        await options.onDataFetched(data);
      }
    } catch (e) {
      console.error("Failed to fetch...", e);

      setError(e);

      notification.error({
        message: "Unable to fetch data",
        description: `The ${options.dataType || "requested data"} could not be fetched`,
      });
    } finally {
      setLoading(false);
    }
  };

  if (!options.noWatch) {
    useEffect(() => {
      (async () => {
        let shouldFetch = true;

        if (options.validateOptions) {
          shouldFetch = options.validateOptions(options.params);
        }

        if (shouldFetch) {
          if (options.beforeDataRequest) {
            await options.beforeDataRequest(options.params);
          }

          await fetcher();
        }
      })();
    }, options.watch || []);
  }

  return [data as T, loading, error, fetcher, setData];
};
