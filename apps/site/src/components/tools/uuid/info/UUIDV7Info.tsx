import { Space, Typography } from "antd";
import type { ItemType } from "rc-collapse/es/interface";
import React from "react";
import {V1_INFO_PANEL, V7_INFO_PANEL} from "../infoPanels";
import { styles } from "./utils";

const UUIDV7Info: ItemType = {
  key: "v7",
  label: "Version 7",
  styles: styles,
  children: (
    <Space direction={"vertical"} size={8}>
      <Typography.Text>
        Version-7 UUIDs features a time-ordered value field derived
        from the widely implemented and well known Unix Epoch
        timestamp source, the number of milliseconds seconds since
        midnight 1 Jan 1970 UTC, leap seconds excluded. As well as
        improved entropy characteristics over versions-1 or version-6.
      </Typography.Text>
      <Typography.Text>
        Implementations SHOULD utilize version-7 over version-1 and
        version-6 if possible.
      </Typography.Text>
      {V7_INFO_PANEL}
    </Space>
  ),
};
export default UUIDV7Info;
