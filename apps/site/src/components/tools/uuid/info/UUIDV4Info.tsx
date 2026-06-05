import { Space, Typography } from "antd";
import type { ItemType } from "@rc-component/collapse/lib/interface";
import React from "react";
import { V4_INFO_PANEL } from "../infoPanels";
import { styles } from "./utils";

const UUIDV4Info: ItemType = {
  key: "v4",
  label: "Version 4",
  styles: styles,
  children: (
    <Space direction={"vertical"} size={8}>
      <Typography.Text>
        Version-4 UUIDs are randomly generated. There are over 5.3 x 1036 unique
        v4 UUIDs. This is the most common UUID version.
      </Typography.Text>
      <Typography.Text>
        Version-4, variant-2 is called a "GUID" on Microsoft systems. GUIDs are
        a Microsoft implementation of DCE UUIDs. GUIDs mostly conform to
        RFC4122. The only difference is in the byte order.
      </Typography.Text>
      {V4_INFO_PANEL}
    </Space>
  ),
};
export default UUIDV4Info;
