import { DownOutlined, FileImageOutlined } from "@ant-design/icons";
import type { TypedImage } from "@ncfritz/olympus-sdk/dionysus";
import { Button, Card, Dropdown, Image, Space, Typography } from "antd";
import Description from "../../common/Description";
import Timestamp from "../../data/Timestamp";
import { getImageDropdownOptions } from "./util";

export interface MovieImagePosterCardProps {
  image: TypedImage;
}

const resolutions: Map<string, number> = new Map([
  ["w92", 92],
  ["w154", 154],
  ["w185", 185],
  ["w300", 300],
  ["w500", 500],
  ["w780", 780],
]);

const MoviePosterCard: React.FunctionComponent<MovieImagePosterCardProps> = ({
  image,
}: MovieImagePosterCardProps) => {
  const items = getImageDropdownOptions(resolutions, image);

  return (
    <Card
      hoverable={true}
      styles={{
        body: {
          margin: 0,
          padding: 0,
          flexDirection: "column",
          justifyContent: "start",
          display: "flex",
        },
        cover: { borderTopRightRadius: "inherit" },
        actions: { margin: 0, padding: 0 },
      }}
      cover={
        image.filePath ? (
          <Image
            src={`https://image.tmdb.org/t/p/w780/${image.filePath}}`}
            alt={"Poster"}
            style={{
              borderTopRightRadius: "inherit",
              borderTopLeftRadius: "inherit",
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
            <FileImageOutlined style={{ fontSize: "64px", color: "#dddddd" }} />
          </Space>
        )
      }
    >
      <Space
        size={3}
        direction={"vertical"}
        style={{ padding: 8, width: "100%" }}
        styles={{ item: { width: "100%", lineHeight: 1 } }}
      >
        <Typography.Title
          level={5}
          style={{
            fontFamily: "monospace",
            fontSize: "11px",
          }}
        >
          {image.filePath}
        </Typography.Title>
        <Description
          direction={"horizontal"}
          title={"Dimensions:"}
          titleFontSize={"12px"}
          titleColor={"#666666"}
          value={
            <Typography.Text>
              {image.width}px x {image.height}px
            </Typography.Text>
          }
        />
        <Description
          style={{ marginTop: 0 }}
          direction={"horizontal"}
          title={"Created:"}
          titleFontSize={"12px"}
          titleColor={"#666666"}
          value={
            <Timestamp
              value={image.createdTime}
              showIcon={false}
              showTime={true}
              direction={"horizontal"}
            />
          }
        />
        <Description
          style={{ marginTop: 0 }}
          direction={"horizontal"}
          title={"Updated:"}
          titleFontSize={"12px"}
          titleColor={"#666666"}
          value={
            <Timestamp
              value={image.lastUpdatedTime}
              showIcon={false}
              showTime={true}
              direction={"horizontal"}
            />
          }
        />
        <Dropdown
          menu={{
            items: items,
            onClick: (e) => {
              console.log(e);
            },
          }}
        >
          <Button
            color={"default"}
            variant={"filled"}
            size={"small"}
            style={{ width: "100%", marginTop: 8 }}
          >
            <Space>
              Image URLs
              <DownOutlined />
            </Space>
          </Button>
        </Dropdown>
      </Space>
    </Card>
  );
};
export default MoviePosterCard;
