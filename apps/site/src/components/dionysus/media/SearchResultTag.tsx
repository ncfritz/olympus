import { Space } from "antd";
import React, { type CSSProperties, type ReactNode } from "react";

export interface SearchResultTagProps {
  color?: string;
  textColor?: string;
  monospace?: boolean;
  children: ReactNode | ReactNode[];
  style?: CSSProperties;
}

const SearchResultTag: React.FunctionComponent<SearchResultTagProps> = ({
  color = "#666666",
  textColor = "#ffffff",
  monospace = false,
  style,
  children,
}: SearchResultTagProps) => {
  return (
    <Space
      styles={{ item: { width: "100%" } }}
      style={{
        width: "100%",
        textAlign: "center",
        alignItems: "center",
        fontSize: "11px",
        fontFamily: monospace ? "monospace" : "inherit",
        color: textColor ? textColor : "inherit",
        backgroundColor: color,
        borderRadius: 4,
        ...style,
      }}
    >
      {children}
    </Space>
  );
};
export default SearchResultTag;
