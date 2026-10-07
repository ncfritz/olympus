import type { MailInboxMessage } from "@ncfritz/olympus-sdk/minerva";
import { Tag, Typography } from "antd";
import React from "react";
import ChangeTag from "./audit/ChangeTag";

const { Text } = Typography;

/** A message's labels now, as default tags. */
export const CurrentLabels: React.FunctionComponent<{
  labels: string[];
  max?: number;
}> = ({ labels, max = 3 }) =>
  labels.length ? (
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
  ) : (
    <Text type={"secondary"}>none</Text>
  );

/**
 * What is suggested to add, as the design draws it: blue with `+` and its
 * confidence, faded when unticked; labels the message has are left out.
 */
export const SuggestedLabels: React.FunctionComponent<{
  message: MailInboxMessage;
  max?: number;
}> = ({ message, max = 2 }) => {
  const adds = message.suggestions.filter((s) => !s.onMessage);
  if (adds.length === 0) {
    return (
      <Text type={"secondary"}>
        {message.scoredTime ? "no suggestion" : "not scored"}
      </Text>
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
