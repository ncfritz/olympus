import type { MailInboxMessage } from "@ncfritz/olympus-sdk/minerva";
import { Tag, theme, Typography } from "antd";
import React from "react";
import { percent } from "../../../utils/mailAudit";
import { confidenceSolid } from "../../../utils/mailInbox";
import ChangeTag from "./audit/ChangeTag";

const { Text } = Typography;

/** A full-width tag, one to a line, its label cut short if it must be. */
const BLOCK: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 6,
  width: "100%",
  margin: "0 0 4px",
  minWidth: 0,
};
const CUT: React.CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  minWidth: 0,
};

/** A badge's width: "100%" in the code font, so 2 and 3 digits match. */
const BADGE_WIDTH = 38;

const More: React.FunctionComponent<{ count: number }> = ({ count }) =>
  count > 0 ? (
    <Text type={"secondary"} style={{ fontSize: 12 }}>
      +{count} more
    </Text>
  ) : null;

/**
 * A message's labels now: default tags, or in `block` (the inbox table)
 * solid gold, full width, one to a line.
 */
export const CurrentLabels: React.FunctionComponent<{
  labels: string[];
  max?: number;
  block?: boolean;
}> = ({ labels, max = 3, block = false }) =>
  labels.length === 0 ? (
    <Text type={"secondary"}>none</Text>
  ) : block ? (
    <>
      {labels.slice(0, max).map((l) => (
        <Tag key={l} color={"gold"} variant={"solid"} style={BLOCK} title={l}>
          <span style={CUT}>{l}</span>
        </Tag>
      ))}
      <More count={labels.length - max} />
    </>
  ) : (
    <>
      {labels.slice(0, max).map((l) => (
        <Tag key={l} style={{ marginInlineEnd: 4 }}>
          {l}
        </Tag>
      ))}
      {labels.length > max ? (
        <Text type={"secondary"}>+{labels.length - max}</Text>
      ) : null}
    </>
  );

/**
 * What is suggested to add, as the design draws it: blue with `+` and its
 * confidence, faded when unticked; labels the message has are left out.
 * In `block` (the inbox table) each is grey, full width and without the
 * `+`, its confidence a fixed-width badge in the code font at its end,
 * solid red to yellow to green as it rises.
 */
export const SuggestedLabels: React.FunctionComponent<{
  message: MailInboxMessage;
  max?: number;
  block?: boolean;
}> = ({ message, max = 2, block = false }) => {
  const { token } = theme.useToken();
  const adds = message.suggestions.filter((s) => !s.onMessage);
  if (adds.length === 0) {
    return (
      <Text type={"secondary"}>
        {message.scoredTime ? "no suggestion" : "not scored"}
      </Text>
    );
  }
  if (block) {
    return (
      <>
        {adds.slice(0, max).map((s) => (
          <Tag
            key={s.label}
            variant={"filled"}
            title={`${s.label}, ${percent(s.score)}${s.ticked ? "" : ", not ticked"}`}
            style={{
              ...BLOCK,
              paddingInlineEnd: 0,
              overflow: "hidden",
              ...(s.ticked ? {} : { opacity: 0.55 }),
            }}
          >
            <span style={CUT}>{s.label}</span>
            <span
              style={{
                ...confidenceSolid(s.score),
                flex: "none",
                alignSelf: "stretch",
                margin: "-1px -1px -1px 0",
                borderRadius: "0 4px 4px 0",
                width: BADGE_WIDTH,
                padding: "1px 0",
                textAlign: "center",
                fontFamily: token.fontFamilyCode,
                fontSize: 11,
                fontWeight: 600,
                lineHeight: "16px",
              }}
            >
              {percent(s.score)}
            </span>
          </Tag>
        ))}
        <More count={adds.length - max} />
      </>
    );
  }
  return (
    <>
      {adds.slice(0, max).map((s) => (
        <ChangeTag
          key={s.label}
          action={"add"}
          label={s.label}
          confidence={s.score}
          unticked={!s.ticked}
        />
      ))}
      {adds.length > max ? (
        <Text type={"secondary"}>+{adds.length - max}</Text>
      ) : null}
    </>
  );
};
