import type {
  MetadataFetchJobStatus,
  MetadataJobType,
} from "@ncfritz/olympus-sdk/dionysus";
import { Typography } from "antd";
import { getMetadataJobStatusIndicator } from "../jobs/utils";

export interface MetadataStatusTableProps {
  statistics: any;
  onCellClick?: (
    type?: MetadataJobType,
    status?: MetadataFetchJobStatus,
  ) => void;
  fontSize?: string;
}

const headStyle = { paddingBottom: 4 };

const MetadataStatusTable: React.FunctionComponent<
  MetadataStatusTableProps
> = ({
  statistics,
  onCellClick,
  fontSize = "12px",
}: MetadataStatusTableProps) => {
  const StatisticStyle = {
    fontFamily: "monospace",
    fontSize: fontSize,
  };

  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        marginTop: 16,
        marginBottom: 16,
      }}
    >
      <thead>
        <tr style={{ borderBottom: "1px solid #f0f0f0" }}>
          <th
            style={{
              ...headStyle,
              verticalAlign: "bottom",
              textAlign: "left",
            }}
          >
            Job Type
          </th>
          <th style={headStyle}>
            {getMetadataJobStatusIndicator("fetched", true)}
          </th>
          <th style={headStyle}>
            {getMetadataJobStatusIndicator("fetching", true)}
          </th>
          <th style={headStyle}>
            {getMetadataJobStatusIndicator("invalidated", true)}
          </th>
          <th style={headStyle}>
            {getMetadataJobStatusIndicator("failed", true)}
          </th>
          <th style={headStyle}>
            {getMetadataJobStatusIndicator("not_found", true)}
          </th>
          <th style={headStyle}>
            {getMetadataJobStatusIndicator("cancelled", true)}
          </th>
          <th style={headStyle}>
            {getMetadataJobStatusIndicator("queued", true)}
          </th>
        </tr>
      </thead>
      <tbody>
        {statistics.status.categories.map((item: string, index: number) => {
          return (
            <tr className={"table-row-hover"}>
              <td style={{ paddingRight: 8 }}>
                <Typography.Text style={{ fontSize: fontSize }}>
                  {item}
                </Typography.Text>
              </td>
              <td
                className={"table-cell-hover"}
                onClick={() => {
                  if (onCellClick) {
                    onCellClick(
                      statistics.expiration.series[index].name,
                      "fetched",
                    );
                  }
                }}
              >
                <Typography.Text style={StatisticStyle}>
                  {statistics.status.series.fetched[index].toLocaleString()}
                </Typography.Text>
              </td>
              <td
                className={"table-cell-hover"}
                onClick={() => {
                  if (onCellClick) {
                    onCellClick(
                      statistics.expiration.series[index].name,
                      "fetching",
                    );
                  }
                }}
              >
                <Typography.Text style={StatisticStyle}>
                  {statistics.status.series.fetching[index].toLocaleString()}
                </Typography.Text>
              </td>
              <td
                className={"table-cell-hover"}
                onClick={() => {
                  if (onCellClick) {
                    onCellClick(
                      statistics.expiration.series[index].name,
                      "invalidated",
                    );
                  }
                }}
              >
                <Typography.Text style={StatisticStyle}>
                  {statistics.status.series.invalidated[index].toLocaleString()}
                </Typography.Text>
              </td>
              <td
                className={"table-cell-hover"}
                onClick={() => {
                  if (onCellClick) {
                    onCellClick(
                      statistics.expiration.series[index].name,
                      "failed",
                    );
                  }
                }}
              >
                <Typography.Text style={StatisticStyle}>
                  {statistics.status.series.failed[index].toLocaleString()}
                </Typography.Text>
              </td>
              <td
                className={"table-cell-hover"}
                onClick={() => {
                  if (onCellClick) {
                    onCellClick(
                      statistics.expiration.series[index].name,
                      "not_found",
                    );
                  }
                }}
              >
                <Typography.Text style={StatisticStyle}>
                  {statistics.status.series.not_found[index].toLocaleString()}
                </Typography.Text>
              </td>
              <td
                className={"table-cell-hover"}
                onClick={() => {
                  if (onCellClick) {
                    onCellClick(
                      statistics.expiration.series[index].name,
                      "cancelled",
                    );
                  }
                }}
              >
                <Typography.Text style={StatisticStyle}>
                  {statistics.status.series.cancelled[index].toLocaleString()}
                </Typography.Text>
              </td>
              <td
                className={"table-cell-hover"}
                onClick={() => {
                  if (onCellClick) {
                    onCellClick(
                      statistics.expiration.series[index].name,
                      "queued",
                    );
                  }
                }}
              >
                <Typography.Text style={StatisticStyle}>
                  {statistics.status.series.queued[index].toLocaleString()}
                </Typography.Text>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};
export default MetadataStatusTable;
