import { DownOutlined, FileImageOutlined } from "@ant-design/icons";
import type { BaseImage } from "@ncfritz/olympus-sdk/dionysus";
import { Button, Card, Dropdown, Image, Space, Typography } from "antd";
import Description from "../../common/Description";
import Timestamp from "../../data/Timestamp";
import { getImageDropdownOptions } from "./util";

export interface PersonProfileCardProps {
  image: BaseImage;
  showId?: boolean;
  showDimensions?: boolean;
  showDates?: boolean;
  showControls?: boolean;
}

const resolutions: Map<string, number> = new Map([
  ["w45", 45],
  ["w185", 185],
  ["w632", 632],
]);

const PersonProfileCard: React.FunctionComponent<PersonProfileCardProps> = ({
  image,
  showId = true,
  showDimensions = true,
  showDates = true,
  showControls = true,
}: PersonProfileCardProps) => {
  const metaShown = showId || showDimensions || showDates || showControls;
  const items = getImageDropdownOptions(resolutions, image);

  return (
    <Card
      hoverable={false}
      styles={{
        body: {
          margin: 0,
          padding: 0,
          flexDirection: "column",
          justifyContent: "start",
          display: metaShown ? "flex" : "none",
        },
        cover: { borderTopRightRadius: "inherit" },
        actions: { margin: 0, padding: 0 },
      }}
      cover={
        image.filePath ? (
          <Image
            src={`https://image.tmdb.org/t/p/h632/${image.filePath}}`}
            alt={"Profile"}
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
        orientation={"vertical"}
        style={{ padding: 8, width: "100%" }}
        styles={{ item: { width: "100%", lineHeight: 1 } }}
      >
        {showId && (
          <Typography.Title
            level={5}
            style={{
              fontFamily: "monospace",
              fontSize: "11px",
            }}
          >
            {image.filePath}
          </Typography.Title>
        )}
        {showDimensions && (
          <Description
            style={{ marginTop: 0 }}
            title={"Dimensions"}
            titleFontSize={"12px"}
            titleColor={"#666666"}
            value={`${image.width}px x ${image.height}px`}
          />
        )}
        {showDates && (
          <>
            <Description
              style={{ marginTop: 0 }}
              direction={"vertical"}
              title={"Created"}
              titleFontSize={"12px"}
              titleColor={"#666666"}
              value={
                <Timestamp
                  value={image.createdTime}
                  showIcon={false}
                  showTime={false}
                  direction={"vertical"}
                />
              }
            />
            <Description
              style={{ marginTop: 0 }}
              direction={"vertical"}
              title={"Updated"}
              titleFontSize={"12px"}
              titleColor={"#666666"}
              value={
                <Timestamp
                  value={image.lastUpdatedTime}
                  showIcon={false}
                  showTime={false}
                  direction={"vertical"}
                />
              }
            />
          </>
        )}
        {showControls && (
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
        )}
      </Space>
    </Card>
  );
};
export default PersonProfileCard;
