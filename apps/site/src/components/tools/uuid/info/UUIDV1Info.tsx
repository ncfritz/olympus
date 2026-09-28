import type { ItemType } from "@rc-component/collapse/lib/interface";
import { Space, Typography } from "antd";
import React from "react";
import { V1_INFO_PANEL } from "../infoPanels";
import { styles } from "./utils";

const UUIDV1Info: ItemType = {
  key: "v1",
  label: "Version 1",
  styles: styles,
  children: (
    <Space orientation={"vertical"} size={8}>
      <Typography.Text>
        Version-1 is based on the current time and the MAC address for the
        computer or "node" generating the UUID.
      </Typography.Text>
      <Typography.Text>
        RFC 4122 states timestamp is number of nanoseconds since October 15,
        1582 at midnight UTC. Most computers do not have a clock that ticks fast
        enough to measure time in nanoseconds. Instead, a random number is often
        used to fill in timestamp digits beyond the computer's measurement
        accuracy. When multiple version-1 UUIDs are generated in a single API
        call the random portion may be incremented rather than regenerated for
        each UUID. This ensures uniqueness and is faster to generate.
      </Typography.Text>
      <Typography.Text>
        The last 12 hex digits of a UUID string represent the MAC address of the
        node. In some implementations (including the UUID generator on this
        site) a random MAC address is used instead of the node's actual MAC.
      </Typography.Text>
      {V1_INFO_PANEL}
    </Space>
  ),
};
export default UUIDV1Info;
