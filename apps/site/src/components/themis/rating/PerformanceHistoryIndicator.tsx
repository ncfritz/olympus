import { Typography } from "antd";

interface PerformanceIndicatorHistoryProps {
  rating: string;
  allowedRatings: string[];
  overridden?: boolean;
  colors: Record<string, string>;
}

const PerformanceHistoryIndicator: React.FunctionComponent<
  PerformanceIndicatorHistoryProps
> = ({ rating, allowedRatings, overridden = false, colors }) => {
  let indicator = <></>;

  if (allowedRatings.indexOf(rating) > -1) {
    indicator = (
      <Typography.Text
        strong={true}
        style={{
          fontSize: 10,
          color: "#fff",
          backgroundColor: colors[rating],
          padding: 3,
          borderRadius: 3,
          width: 25,
          height: 25,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: overridden ? "4px solid red" : "none",
        }}
      >
        X
      </Typography.Text>
    );
  }

  return indicator;
};
export default PerformanceHistoryIndicator;
