import { QuestionCircleFilled } from "@ant-design/icons";
import type { AntdIconProps } from "@ant-design/icons/es/components/AntdIcon";
import { Popover, Space, Typography } from "antd";
import type { TooltipPlacement } from "antd/es/tooltip";
import { type DataType, type Globals } from "csstype";
import type { CSSProperties, ReactNode } from "react";

export interface DescriptionProps {
  style?: CSSProperties;
  titleColor?: Globals | DataType.Color | "currentColor";
  titleFontSize?: number | string;
  valueStyle?: CSSProperties;
  title: string | number;
  value: string | number | ReactNode;
  emptyText?: string;
  helpContent?: ReactNode;
  helpIcon?: AntdIconProps;
  helpPosition?: TooltipPlacement;
  direction?: "horizontal" | "vertical";
}

const Description: React.FunctionComponent<DescriptionProps> = ({
  style,
  titleColor = "#333333",
  valueStyle,
  title,
  titleFontSize = "16px",
  value,
  emptyText = "Unknown",
  helpContent,
  helpIcon = <QuestionCircleFilled />,
  helpPosition = "right",
  direction = "vertical",
}: DescriptionProps) => {
  return (
    <Space direction={direction} style={{ marginTop: 8, ...style }} size={2}>
      <Typography.Text
        style={{
          fontSize: titleFontSize,
          color: titleColor || "inherit",
          fontWeight: 500,
          paddingBottom: 0,
        }}
      >
        <Space direction={"horizontal"} size={8}>
          {title}
          {helpContent && (
            <Popover placement={helpPosition} content={helpContent}>
              <>{helpIcon}</>
            </Popover>
          )}
        </Space>
      </Typography.Text>
      <Typography.Text
        style={{ fontSize: "12px", color: "#666666", ...valueStyle }}
        italic={!value}
      >
        {value || emptyText}
      </Typography.Text>
    </Space>
  );
};
export default Description;
