import { FileImageOutlined } from "@ant-design/icons";
import type { ProductionCompanyAssociation } from "@ncfritz/olympus-sdk/dionysus";
import {
  Card,
  Descriptions,
  Empty,
  Image,
  List,
  Space,
  Typography,
} from "antd";
import Link from "next/link";
import Timestamp from "../../data/Timestamp";

export interface MovieProductionCompaniesPanelProps {
  productionCompanies: ProductionCompanyAssociation[];
}

const MovieProductionCompaniesPanel: React.FunctionComponent<
  MovieProductionCompaniesPanelProps
> = ({ productionCompanies }: MovieProductionCompaniesPanelProps) => {
  let content = (
    <Space style={{ width: "100%", margin: 64, justifyContent: "center" }}>
      <Empty />
    </Space>
  );

  if (productionCompanies && productionCompanies.length > 0) {
    content = (
      <List
        grid={{ gutter: 16, column: 2 }}
        dataSource={productionCompanies}
        renderItem={(item) => {
          return (
            <List.Item>
              <Link
                href={`/dionysus/productionCompanies/${item.productionCompany.id}`}
              >
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
                    {item.productionCompany.logoPath ? (
                      <Space
                        direction={"vertical"}
                        style={{
                          alignItems: "center",
                          justifyContent: "start",
                          height: "100%",
                          minWidth: 250,
                        }}
                      >
                        <Image
                          src={`https://image.tmdb.org/t/p/w500/${item.productionCompany.logoPath}.jpg`}
                          alt={"Poster"}
                          style={{
                            width: 250,
                            maxHeight: 250,
                            maxWidth: 250,
                            padding: 16,
                            borderTopRightRadius: "inherit",
                            borderTopLeftRadius: "inherit",
                          }}
                          preview={false}
                        />
                      </Space>
                    ) : (
                      <Space
                        style={{
                          width: 250,
                          height: 250,
                          backgroundColor: "#eeeeee",
                          alignItems: "center",
                          justifyContent: "center",
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
                    )}
                    <Space direction={"vertical"} style={{ padding: 16 }}>
                      <Typography.Title level={5}>
                        {item.productionCompany.name}
                      </Typography.Title>
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
                                {item.productionCompany.id}
                              </Typography.Text>
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
              </Link>
            </List.Item>
          );
        }}
      />
    );
  }

  return content;
};
export default MovieProductionCompaniesPanel;
