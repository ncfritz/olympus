import { Space, Typography } from "antd";
import prettyBytes from "pretty-bytes";
import type { CSSProperties, ReactNode } from "react";

export interface MetadataTitleProps {
  fontSize?: number;
  strong?: boolean;
  monospace?: boolean;
  style?: CSSProperties;
  children: ReactNode | ReactNode[];
}

export const MetadataTitle: React.FunctionComponent<MetadataTitleProps> = ({
  fontSize = 14,
  strong = false,
  monospace = false,
  style,
  children,
}: MetadataTitleProps) => {
  return (
    <Typography.Text
      strong={strong}
      style={{
        display: "flex",
        fontFamily: monospace ? "monospace" : undefined,
        fontSize: fontSize,
        ...style,
      }}
    >
      {children}
    </Typography.Text>
  );
};

export interface MetadataDetailProps {
  title: string;
  monospace?: boolean;
  children: ReactNode | ReactNode[];
}

export const MetadataDetail: React.FunctionComponent<MetadataDetailProps> = ({
  title,
  monospace = false,
  children,
}: MetadataDetailProps) => {
  return (
    <Space direction={"horizontal"} size={8} style={{ alignItems: "center" }}>
      <Typography.Text
        strong={true}
        style={{
          fontSize: "11px",
          width: 90,
          justifyContent: "end",
          display: "flex",
        }}
      >
        {title}:
      </Typography.Text>
      <Typography.Text
        style={{
          fontSize: "11px",
          fontFamily: monospace ? "monospace" : undefined,
        }}
      >
        {children}
      </Typography.Text>
    </Space>
  );
};
