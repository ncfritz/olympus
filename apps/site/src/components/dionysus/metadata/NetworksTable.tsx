import {
  ExportOutlined,
  FileImageOutlined,
  HomeOutlined,
} from "@ant-design/icons";
import type { NetworkWithContentCounts } from "@ncfritz/olympus-sdk/dionysus";
import {
  Avatar,
  Col,
  Image,
  type PaginationProps,
  Popover,
  Row,
  Space,
  Table,
  type TablePaginationConfig,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type {
  FilterValue,
  SorterResult,
  TableCurrentDataSource,
} from "antd/es/table/interface";
import Link from "next/link";
import React, { type ReactNode } from "react";
import ReactCountryFlag from "react-country-flag/src";
import { TvIcon } from "../../../icons";
import Timestamp from "../../data/Timestamp";

export interface NetworkTableTableProps {
  data: NetworkWithContentCounts[];
  loading: boolean;
  pagination?: PaginationProps;
  onChange?: (
    pagination: TablePaginationConfig,
    filters: Record<string, FilterValue | null>,
    sorter:
      | SorterResult<NetworkWithContentCounts>
      | SorterResult<NetworkWithContentCounts>[],
    extra: TableCurrentDataSource<NetworkWithContentCounts>,
  ) => void;
}

const NetworkTable: React.FunctionComponent<NetworkTableTableProps> = ({
  data,
  loading,
  pagination,
  onChange,
}: NetworkTableTableProps) => {
  const columns: ColumnsType<NetworkWithContentCounts> = [
    {
      key: "name",
      title: "Name",
      dataIndex: "name",
      render: (value, record) => {
        let content = (
          <Avatar size={45} shape={"square"} icon={<FileImageOutlined />} />
        );

        if (record.logoPath) {
          content = (
            <Image
              src={`https://image.tmdb.org/t/p/w300/${record.logoPath}.jpg`}
              alt={`${record.name} logo`}
              style={{
                maxHeight: 45,
              }}
              preview={false}
            />
          );
        }

        return (
          <Link href={`/dionysus/tv/networks/${record.id}`}>{content}</Link>
        );
      },
      sorter: false,
      width: 45,
    },
    {
      key: "id",
      title: "ID",
      dataIndex: "id",
      render: (value, record) => {
        return (
          <Link href={`/dionysus/tv/networks/${record.id}`}>
            <Typography.Text>{record.id}</Typography.Text>
          </Link>
        );
      },
      sorter: true,
      width: 80,
    },
    {
      key: "name",
      title: "Name",
      dataIndex: "name",
      render: (value, record) => {
        return (
          <Space direction={"vertical"} size={0}>
            <Link href={`/dionysus/tv/networks/${record.id}`}>
              <Typography.Text
                style={{ fontWeight: 500, fontSize: "15px", lineHeight: 0 }}
              >
                {record.name}
              </Typography.Text>
            </Link>
            {record.homepage && (
              <Typography.Text style={{ fontSize: "11px" }}>
                <Space direction={"horizontal"} size={4}>
                  <HomeOutlined />
                  <Link href={record.homepage} style={{ fontSize: "11px" }}>
                    <Space direction={"horizontal"} size={4}>
                      <Typography.Text
                        style={{ fontSize: "inherit", color: "inherit" }}
                      >
                        {record.homepage}
                      </Typography.Text>
                      <ExportOutlined />
                    </Space>
                  </Link>
                </Space>
              </Typography.Text>
            )}
          </Space>
        );
      },
      sorter: true,
      width: 400,
    },
    {
      key: "headquarters",
      title: "Headquarters",
      dataIndex: "headquarters",
      render: (value, record) => {
        return <Typography.Text>{record.headquarters}</Typography.Text>;
      },
      sorter: true,
      width: 250,
    },
    {
      key: "originCountry",
      title: "Country",
      dataIndex: "originCountry",
      render: (value, record) => {
        let content = <Typography.Text italic={true}>Unknown</Typography.Text>;

        if (record.originCountry) {
          content = (
            <Space direction={"horizontal"} size={8} align={"center"}>
              <ReactCountryFlag
                countryCode={record.originCountry.id}
                cdnUrl={"/flags/"}
                cdnSuffix={"svg"}
                svg={true}
              />
              <Typography>{record.originCountry.name}</Typography>
            </Space>
          );
        }

        return content;
      },
      sorter: true,
      width: 300,
    },
    {
      key: "tvSeriesCount",
      title: <TvIcon />,
      dataIndex: "tvSeriesCount",
      render: (value, record) => {
        return record.tvSeriesCount;
      },
      width: 80,
      sorter: false,
    },
    {
      key: "alternativeNames",
      title: "Alt. Names",
      dataIndex: "alternativeNames",
      render: (value, record) => {
        let titleContent: ReactNode | undefined = undefined;
        let popoverContent: ReactNode | undefined = undefined;

        if (record.alternativeNames.length > 1) {
          titleContent = (
            <Space direction={"horizontal"} size={4}>
              <Typography.Text>
                {record.alternativeNames[0].name}
              </Typography.Text>
              <Typography.Text style={{ fontSize: "10px", color: "#666666" }}>
                {" "}
                and {record.alternativeNames.length - 1} more...
              </Typography.Text>
            </Space>
          );
        } else if (record.alternativeNames.length > 0) {
          titleContent = (
            <Typography.Text>{record.alternativeNames[0].name}</Typography.Text>
          );
        }

        if (record.alternativeNames.length > 0) {
          popoverContent = (
            <>
              {record.alternativeNames.map((altName) => {
                return (
                  <Row gutter={8}>
                    <Col span={8}>
                      <Typography.Text
                        style={{
                          fontSize: "11px",
                          color: "#666666",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {altName.type ? altName.type : "Additional Name"}:
                      </Typography.Text>
                    </Col>
                    <Col span={14}>
                      <Typography.Text
                        style={{ fontSize: "11px", whiteSpace: "nowrap" }}
                      >
                        {altName.name}
                      </Typography.Text>
                    </Col>
                  </Row>
                );
              })}
            </>
          );
        }

        return popoverContent ? (
          <Popover content={popoverContent}>{titleContent}</Popover>
        ) : undefined;
      },
      sorter: false,
    },
    {
      key: "createdTime",
      title: "Created",
      dataIndex: "createdTime",
      render: (value) => {
        return <Timestamp value={value} showTime={true} />;
      },
      sorter: true,
      width: 200,
    },
    {
      key: "last_updated_at",
      title: "Last Updated",
      dataIndex: "lastUpdatedTime",
      render: (value) => {
        return <Timestamp value={value} showTime={true} />;
      },
      sorter: true,
      width: 200,
    },
  ];

  return (
    <Table
      style={{ width: "100%" }}
      rowKey={"id"}
      columns={columns}
      dataSource={data}
      size={"middle"}
      loading={loading}
      pagination={pagination}
      onChange={onChange}
    />
  );
};
export default NetworkTable;
