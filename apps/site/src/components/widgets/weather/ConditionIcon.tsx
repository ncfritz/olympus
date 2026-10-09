import { type WeatherConditionKind } from "@ncfritz/olympus-sdk/olympus";

export interface ConditionIconProps {
  kind: WeatherConditionKind;
  isDaytime?: boolean;
  /** What the icon means, for screen readers: the provider's wording. */
  label: string;
  size?: number;
}

const AMBER = "#d48806";
const GREY = "#595959";
const BLUE = "#0958d9";

const CLOUD =
  "M7 15h10a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.1 6.1 4.5 4.5 0 0 0 7 15z";
const LOW_CLOUD =
  "M7 18h10a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.1 9.1 4.5 4.5 0 0 0 7 18z";

/**
 * A weather icon for a condition kind (the model's `WeatherConditionKind`),
 * drawn as stroke SVG in the design's colours. AntD has no weather icons.
 */
const ConditionIcon: React.FunctionComponent<ConditionIconProps> = ({
  kind,
  isDaytime = true,
  label,
  size = 26,
}: ConditionIconProps) => {
  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {shapes(kind, isDaytime)}
    </svg>
  );
};

const shapes = (kind: WeatherConditionKind, isDaytime: boolean) => {
  switch (kind) {
    case "clear":
      return isDaytime ? (
        <g stroke={AMBER}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </g>
      ) : (
        <path stroke={GREY} d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
      );
    case "partly_cloudy":
      return (
        <>
          {isDaytime ? (
            <g stroke={AMBER}>
              <circle cx="8" cy="8" r="3" />
              <path d="M8 2.5v1M3.5 3.5l.8.8M2.5 8h1M12.5 3.5l-.8.8" />
            </g>
          ) : (
            <path
              stroke={GREY}
              d="M11 9.5A4 4 0 0 1 5.5 4a4 4 0 1 0 5.5 5.5z"
            />
          )}
          <path
            stroke={GREY}
            d="M9 20h8a3.5 3.5 0 0 0 .5-6.96A5 5 0 0 0 8.2 12.3 3.9 3.9 0 0 0 9 20z"
          />
        </>
      );
    case "cloudy":
      return <path stroke={GREY} d={LOW_CLOUD} />;
    case "fog":
      return <path stroke={GREY} d="M4 9h16M3 13h18M5 17h14" />;
    case "drizzle":
      return (
        <>
          <path stroke={GREY} d={CLOUD} />
          <path stroke={BLUE} d="M9 19v1M13 19v1M17 19v1" />
        </>
      );
    case "snow":
      return (
        <>
          <path stroke={GREY} d={CLOUD} />
          <path
            stroke={BLUE}
            d="M8 19h.01M12 20h.01M16 19h.01M10 22h.01M14 22h.01"
          />
        </>
      );
    case "thunderstorm":
      return (
        <>
          <path stroke={GREY} d={CLOUD} />
          <path stroke={AMBER} d="M12 15l-2 4h3l-2 4" />
        </>
      );
    case "rain":
    default:
      return (
        <>
          <path stroke={GREY} d={CLOUD} />
          <path stroke={BLUE} d="M9 18l-1 3M13 18l-1 3M17 18l-1 3" />
        </>
      );
  }
};

export default ConditionIcon;
