import { EyeOutlined, HeartOutlined } from "@ant-design/icons";
import type { BaseTvSeries } from "@ncfritz/olympus-sdk/dionysus";
import { Badge, List } from "antd";
import Link from "next/link";
import TvSeriesPosterCard from "./TvSeriesPosterCard";

export interface TvSeriesListProps {
  tvSeries: BaseTvSeries[];
  loading: boolean;
  showStatus?: boolean;
  columns?: number;
}

const TvSeriesList: React.FunctionComponent<TvSeriesListProps> = ({
  tvSeries,
  loading,
  showStatus = true,
  columns = 12,
}: TvSeriesListProps) => {
  return (
    <List
      grid={{ gutter: 16, column: columns }}
      dataSource={tvSeries}
      loading={loading}
      renderItem={(item) => {
        return (
          <List.Item>
            <Badge.Ribbon style={{ fontSize: "9px" }} text={"In Library"}>
              <Link href={`/dionysus/tv/series/${item.id}`}>
                <TvSeriesPosterCard
                  tvSeries={item}
                  showStatus={showStatus}
                  showTitle={true}
                  hoverable={false}
                  className={"compact"}
                  actions={[
                    <HeartOutlined
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                    />,
                    <EyeOutlined
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                    />,
                  ]}
                />
              </Link>
            </Badge.Ribbon>
          </List.Item>
        );
      }}
    />
  );
};
export default TvSeriesList;
