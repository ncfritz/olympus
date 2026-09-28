import type { IdentifiableImage } from "@ncfritz/olympus-sdk/dionysus";
import { Card, Descriptions, Image, List, Typography } from "antd";
import React from "react";
import Timestamp from "../../data/Timestamp";

export interface ProductionCompanyLogoListProps {
  logos: IdentifiableImage[];
  loading: boolean;
}

const ProductionCompanyLogoList: React.FunctionComponent<
  ProductionCompanyLogoListProps
> = ({ logos, loading }: ProductionCompanyLogoListProps) => {
  return (
    <List
      grid={{ gutter: 16, column: 5 }}
      dataSource={logos}
      loading={loading}
      renderItem={(item) => (
        <List.Item>
          <Card
            hoverable={false}
            styles={{
              cover: {
                justifyContent: "center",
              },
            }}
            cover={
              <Image
                src={`https://image.tmdb.org/t/p/w500/${item.filePath}}`}
                style={{
                  maxHeight: 600,
                  maxWidth: 350,
                  margin: 16,
                  borderTopRightRadius: "inherit",
                  borderTopLeftRadius: "inherit",
                }}
              />
            }
          >
            <Card.Meta
              title={item.id}
              description={
                <Descriptions
                  className={"compact"}
                  styles={{ label: { paddingBottom: 0 } }}
                  layout={"vertical"}
                  column={2}
                  items={[
                    {
                      key: "created",
                      label: "Created",
                      children: (
                        <Timestamp
                          value={item.createdTime}
                          showTime={true}
                          direction={"horizontal"}
                        />
                      ),
                    },
                    {
                      key: "updated",
                      label: "Last Updated",
                      children: (
                        <Timestamp
                          value={item.lastUpdatedTime}
                          showTime={true}
                          direction={"horizontal"}
                        />
                      ),
                    },
                    {
                      key: "dimensions",
                      label: "Dimensions",
                      children: (
                        <Typography.Text>
                          {item.width}px x {item.height}px
                        </Typography.Text>
                      ),
                    },
                    {
                      key: "fileType",
                      label: "File Type",
                      children: (
                        <Typography.Text>{item.fileType}</Typography.Text>
                      ),
                    },
                    {
                      key: "filePath",
                      label: "File Path",
                      children: (
                        <Typography.Text>{item.filePath}</Typography.Text>
                      ),
                    },
                  ]}
                />
              }
            />
          </Card>
        </List.Item>
      )}
    />
  );
};
export default ProductionCompanyLogoList;
