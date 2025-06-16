import { Space, Typography } from "antd";
import type { ItemType } from "rc-collapse/es/interface";
import React from "react";
import { V6_INFO_PANEL } from "../infoPanels";
import { styles } from "./utils";

const UUIDV6Info: ItemType = {
  key: "v6",
  label: "Version 6",
  styles: styles,
  children: (
    <Space direction={"vertical"} size={8}>
      <Typography.Text>
        Version-6 UUIDs are a field-compatible version of Version -1 UUIDs,
        reordered for improved DB locality. It is expected that version-6 UUIDs
        will primarily be used in contexts where there are existing Version 1
        UUIDs. Systems that do not involve legacy version-1 UUIDs SHOULD
        consider using version-7 UUIDs instead.
      </Typography.Text>
      <Typography.Text>
        Instead of splitting the timestamp into the low, mid and high sections
        from version-1, version-6 changes this sequence so timestamp bytes are
        stored from most to least significant. That is, given a 60 bit timestamp
        value as specified for Version 1 in RFC4122, Section 4.1.4, for Version
        6, the first 48 most significant bits are stored first, followed by the
        4-bit version (same position), followed by the remaining 12 bits of the
        original 60 bit timestamp.
      </Typography.Text>
      <Typography.Text>
        The clock sequence bits remain unchanged from their usage and position
        in [RFC4122], Section 4.1.5.
      </Typography.Text>
      <Typography.Text>
        The 48 bit node SHOULD be set to a pseudo-random value however
        implementations MAY choose to retain the old MAC address behavior from
        [RFC4122], Section 4.1.6 and [RFC4122], Section 4.5.
      </Typography.Text>
      {V6_INFO_PANEL}
    </Space>
  ),
};
export default UUIDV6Info;
