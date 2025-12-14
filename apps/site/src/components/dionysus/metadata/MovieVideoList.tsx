import {
  QuestionCircleFilled,
  SafetyCertificateFilled,
  VideoCameraOutlined,
  YoutubeFilled,
} from "@ant-design/icons";
import type { Video } from "@ncfritz/olympus-sdk/dionysus";
import { Card, Descriptions, Empty, List, Space, Typography } from "antd";
import ReactPlayer from "react-player";
import Timestamp from "../../data/Timestamp";
export interface MovieVideoListProps {
  videos: Video[];
}

const MovieVideoList: React.FunctionComponent<MovieVideoListProps> = ({
  videos,
}: MovieVideoListProps) => {
  let content = (
    <Space style={{ width: "100%", margin: 64, justifyContent: "center" }}>
      <Empty />
    </Space>
  );

  if (videos && videos.length > 0) {
    content = (
      <List
        grid={{ gutter: 16, column: 1 }}
        dataSource={videos}
        renderItem={(item) => {
          let srcUrl;
          let icon = <QuestionCircleFilled />;

          if (item.site === "YouTube") {
            srcUrl = `https://www.youtube.com/watch?v=${item.key}`;
            icon = <YoutubeFilled />;
          } else if (item.site === "Vimeo") {
            srcUrl = `https://vimeo.com/${item.key}`;
            icon = <VideoCameraOutlined />;
          }

          return (
            <List.Item>
              <Card
                variant={"outlined"}
                hoverable={false}
                styles={{
                  body: {
                    margin: 0,
                    padding: 0,
                    borderTopLeftRadius: "inherit",
                    borderBottomLeftRadius: "inherit",
                    height: 250,
                  },
                }}
              >
                <Space
                  direction={"horizontal"}
                  size={16}
                  style={{
                    height: "100%",
                    borderTopLeftRadius: "inherit",
                    borderBottomLeftRadius: "inherit",
                  }}
                  styles={{
                    item: {
                      height: "100%",
                      borderTopLeftRadius: "inherit",
                      borderBottomLeftRadius: "inherit",
                    },
                  }}
                >
                  <ReactPlayer
                    slot={"test"}
                    className={"left-rounded"}
                    style={{
                      height: "100%",
                      width: "auto",
                      aspectRatio: "16/9",
                      borderTopLeftRadius: "inherit",
                      borderBottomLeftRadius: "inherit",
                    }}
                    pip={false}
                    src={srcUrl}
                    controls={true}
                    muted={true}
                    playing={false}
                    config={{
                      youtube: {
                        color: "white",
                      },
                      vimeo: {
                        color: "ffffff",
                      },
                    }}
                  />
                  <Space direction={"vertical"} style={{ padding: 16 }}>
                    <Typography.Title level={5}>{item.name}</Typography.Title>
                    {item.official && (
                      <Space direction={"horizontal"} size={8}>
                        <SafetyCertificateFilled style={{ fontSize: "12px" }} />
                        <Typography.Text>Official</Typography.Text>
                      </Space>
                    )}
                    <Descriptions
                      size={"small"}
                      layout={"horizontal"}
                      column={1}
                      items={[
                        {
                          key: "id",
                          label: "ID",
                          children: (
                            <Typography.Text style={{ fontSize: "11px" }}>
                              {item.id}
                            </Typography.Text>
                          ),
                        },
                        {
                          key: "published",
                          label: "Site",
                          children: (
                            <Typography.Text style={{ fontSize: "11px" }}>
                              {item.site}
                            </Typography.Text>
                          ),
                        },
                        {
                          key: "published",
                          label: "Published",
                          children: (
                            <Timestamp
                              value={item.publishedTime}
                              showTime={false}
                              showIcon={false}
                            />
                          ),
                        },
                        {
                          key: "created",
                          label: "Record Created",
                          children: (
                            <Timestamp
                              value={item.createdTime}
                              showTime={false}
                              showIcon={false}
                            />
                          ),
                        },
                        {
                          key: "updated",
                          label: "Record Updated",
                          children: (
                            <Timestamp
                              value={item.lastUpdatedTime}
                              showTime={false}
                              showIcon={false}
                            />
                          ),
                        },
                      ]}
                    />
                  </Space>
                </Space>
              </Card>
            </List.Item>
          );
        }}
      />
    );
  }

  return content;
};
export default MovieVideoList;
