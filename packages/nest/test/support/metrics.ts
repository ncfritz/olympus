import { register } from "prom-client";

/** The observation count of a request histogram per label set (JSON-encoded labels -> count). */
export const requestCounts = async (
  name: string,
): Promise<Record<string, number>> => {
  const metric = register.getSingleMetric(name);
  if (!metric) return {};
  const { values } = await metric.get();
  return Object.fromEntries(
    values
      // Histogram values carry the series name (…_bucket, …_sum, …_count).
      .filter(
        (v) => (v as { metricName?: string }).metricName === `${name}_count`,
      )
      .map((v) => [JSON.stringify(v.labels), v.value]),
  );
};
