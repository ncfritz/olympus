import { Tag } from "antd";
import React from "react";

/**
 * A state label as the design draws one: gold and dashed, with whether it
 * is open (wants attention) or closed (done), and marked if initial.
 */
const StateTag: React.FunctionComponent<{
  name: string;
  open: boolean;
  initial?: boolean;
}> = ({ name, open, initial }) => (
  <Tag color={"gold"} style={{ borderStyle: "dashed", marginInlineEnd: 4 }}>
    {name} · {open ? "open" : "closed"}
    {initial ? " · initial" : ""}
  </Tag>
);

export default StateTag;
