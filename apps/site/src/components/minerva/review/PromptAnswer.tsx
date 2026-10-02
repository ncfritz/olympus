import type { ReviewAnswer, ReviewPrompt } from "@ncfritz/olympus-sdk/minerva";
import { Flex, Input, Tag, Typography } from "antd";
import React, { useEffect, useState } from "react";

const { Text } = Typography;

export interface PromptAnswerProps {
  prompt: ReviewPrompt;
  answer?: ReviewAnswer;
  disabled?: boolean;
  rows?: number;
  onSave: (body: string) => Promise<void>;
}

/** A prompt and its answer, saved when the box is left. */
const PromptAnswer: React.FunctionComponent<PromptAnswerProps> = ({
  prompt,
  answer,
  disabled = false,
  rows = 2,
  onSave,
}) => {
  const [text, setText] = useState(answer?.body ?? "");
  useEffect(() => setText(answer?.body ?? ""), [answer?.body]);
  const id = `prompt-${prompt.id}`;
  return (
    <Flex vertical={true} gap={6}>
      <Flex gap={8} align={"center"}>
        <Text strong={true}>
          <label htmlFor={id}>{prompt.label}</label>
        </Text>
        {answer?.editedLater && <Tag>Edited later</Tag>}
      </Flex>
      <Input.TextArea
        id={id}
        value={text}
        disabled={disabled}
        placeholder={prompt.placeholder}
        maxLength={10000}
        autoSize={{ minRows: rows, maxRows: 12 }}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => void onSave(text)}
      />
    </Flex>
  );
};

export default PromptAnswer;
