import { CaretDownOutlined, CaretRightOutlined } from "@ant-design/icons";
import { Collapse, Result, Space, Typography } from "antd";
import type { ReactNode } from "react";

export interface ErrorBlockProps {
  title?: string;
  message?: string;
  error?: Error;
  includeStack?: boolean;
  extra?: ReactNode | ReactNode[];
}

const ErrorBlock: React.FunctionComponent<ErrorBlockProps> = ({
  title = "An unexpected error occurred",
  message,
  error,
  includeStack = true,
  extra,
}: ErrorBlockProps) => {
  return (
    <Result status="error" title={title} subTitle={message} extra={extra}>
      {error && includeStack && (
        <Space
          direction={"vertical"}
          size={8}
          style={{ width: 1200, alignItems: "start" }}
        >
          <Typography.Title level={5}>Error: {error.name}</Typography.Title>
          <Typography.Text>{error.message}</Typography.Text>
          <Collapse
            ghost={true}
            expandIcon={(props) => {
              return props.isActive ? (
                <CaretDownOutlined />
              ) : (
                <CaretRightOutlined />
              );
            }}
            items={[
              {
                key: "e_stack",
                label: (
                  <Typography.Text strong={true}>Stack Trace:</Typography.Text>
                ),
                styles: {
                  header: { textAlign: "start" },
                },
                children: (
                  <pre
                    style={{
                      fontFamily: "monospace",
                      fontSize: "12px",
                      textAlign: "start",
                      marginLeft: 24,
                      marginTop: 8,
                    }}
                  >
                    {error.stack}
                  </pre>
                ),
              },
            ]}
          />
        </Space>
      )}
    </Result>
  );
};
export default ErrorBlock;
