import { FileImageOutlined } from "@ant-design/icons";
import type { TvSeriesCrewMember } from "@ncfritz/olympus-sdk/dionysus";
import { Card, Image, List, Space, Typography } from "antd";
import Link from "next/link";

export interface TvSeriesCrewList {
  crew: TvSeriesCrewMember[];
}

const TvSeriesCrewList: React.FunctionComponent<TvSeriesCrewList> = ({
  crew,
}: TvSeriesCrewList) => {
  return (
    <List
      grid={{ column: 1, gutter: 16 }}
      dataSource={crew}
      renderItem={(item) => {
        const image = item.person.profilePath ? (
          <Image
            width={75}
            src={`https://image.tmdb.org/t/p/h632/${item.person.profilePath}}`}
            alt={"Poster"}
            preview={false}
            style={{ borderRadius: 8, aspectRatio: "calc(2 / 3)", margin: 8 }}
          />
        ) : (
          <Space
            style={{
              width: 75,
              aspectRatio: "calc(2 / 3)",
              backgroundColor: "#eeeeee",
              borderRadius: 8,
              margin: 8,
            }}
            styles={{
              item: {
                display: "flex",
                alignContent: "center",
                justifyContent: "center",
                height: "100%",
              },
            }}
          >
            <FileImageOutlined style={{ fontSize: "64px", color: "#dddddd" }} />
          </Space>
        );

        return (
          <List.Item>
            <Link href={`/dionysus/person/${item.person.id}`}>
              <Card
                variant={"borderless"}
                hoverable={true}
                styles={{
                  body: {
                    margin: 0,
                    padding: 0,
                    flexDirection: "column",
                    justifyContent: "start",
                    display: "flex",
                  },
                  actions: { margin: 0, padding: 0 },
                }}
              >
                <Space
                  direction={"horizontal"}
                  size={16}
                  style={{ alignItems: "start" }}
                >
                  {image}
                  <Space
                    size={3}
                    direction={"vertical"}
                    style={{ padding: 8, width: "100%" }}
                    styles={{ item: { width: "100%", lineHeight: 1 } }}
                  >
                    <Typography.Text
                      strong={true}
                      style={{
                        fontSize: "14px",
                        lineHeight: 1,
                      }}
                    >
                      {item.person.name}
                    </Typography.Text>

                    <Space
                      direction={"vertical"}
                      size={2}
                      style={{ width: "100%" }}
                    >
                      {item.jobs.map((job) => {
                        return (
                          <Space
                            direction={"horizontal"}
                            style={{ width: "100%" }}
                          >
                            <Typography.Text style={{ fontSize: "11px" }}>
                              {job.job}
                            </Typography.Text>
                            <Typography.Text
                              style={{ fontSize: "10px", color: "#666666" }}
                            >
                              ({job.episodeCount}{" "}
                              {job.episodeCount > 1 ? "episodes" : "episode"})
                            </Typography.Text>
                          </Space>
                        );
                      })}
                    </Space>
                  </Space>
                </Space>
              </Card>
            </Link>
          </List.Item>
        );
      }}
    />
  );
};
export default TvSeriesCrewList;
