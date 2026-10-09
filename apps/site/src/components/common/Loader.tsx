import { Space, Spin } from "antd";
import React from "react";

const Loader: React.FunctionComponent = () => {
  return (
    <Space
      direction={"vertical"}
      style={{ width: "100%", padding: 64, textAlign: "center" }}
    >
      <Spin size={"large"} />
    </Space>
  );
};
export default Loader;
