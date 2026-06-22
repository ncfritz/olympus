import { FileImageOutlined } from "@ant-design/icons";
import type { TvSeriesCastMember } from "@ncfritz/olympus-sdk/dionysus";
import { Card, Image, List, Space, Typography } from "antd";
import Link from "next/link";

export interface TvCastListProps {
  cast: TvSeriesCastMember[];
}

const TvCastList: React.FunctionComponent<TvCastListProps> = ({
  cast,
}: TvCastListProps) => {
  return (
    <List
      grid={{ column: 12, gutter: 16 }}
      dataSource={cast}
      renderItem={(item) => {
        return (
          <List.Item>
            <Link href={`/dionysus/person/${item.person.id}`}>
              <Card
                hoverable={false}
                styles={{
                  body: {
                    margin: 0,
                    padding: 8,
                    flexDirection: "column",
                    justifyContent: "start",
                    display: "flex",
                    borderTopLeftRadius: "inherit",
                    borderTopRightRadius: "inherit",
                  },
                  actions: { margin: 0, padding: 0 },
                }}
                cover={
                  item.person.profilePath ? (
                    <Image
                      src={`https://image.tmdb.org/t/p/h632/${item.person.profilePath}}`}
                      alt={"Poster"}
                      preview={false}
                      style={{
                        borderTopLeftRadius: 8,
                        borderTopRightRadius: 8,
                      }}
                    />
                  ) : (
                    <Space
                      style={{
                        aspectRatio: "calc(2 / 3)",
                        backgroundColor: "#eeeeee",
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
                      <FileImageOutlined
                        style={{ fontSize: "64px", color: "#dddddd" }}
                      />
                    </Space>
                  )
                }
              >
                <Space
                  size={3}
                  orientation={"vertical"}
                  style={{ padding: 8, width: "100%" }}
                  styles={{ item: { width: "100%", lineHeight: 1 } }}
                >
                  <Typography.Text
                    style={{
                      fontSize: "10px",
                      lineHeight: 1,
                    }}
                  >
                    {item.person.name}
                  </Typography.Text>
                  <Typography.Text
                    style={{
                      fontSize: "9px",
                      color: "#666666",
                      lineHeight: 1,
                    }}
                  >
                    {item.roles[0].character}
                  </Typography.Text>
                </Space>
              </Card>
            </Link>
          </List.Item>
        );
      }}
    />
  );
};
export default TvCastList;
