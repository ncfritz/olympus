import type { ReviewAnswer, ReviewPrompt } from "@ncfritz/olympus-sdk/minerva";
import { Flex, Input, Tag, Typography } from "antd";
import React, { useEffect, useState } from "react";
import AnswerList from "./AnswerList";
import type { AnswerActions } from "./reviewHooks";

const { Text } = Typography;

export interface PromptAnswerProps {
  prompt: ReviewPrompt;
  /** The prompt's answers in the review, in their order. */
  answers: ReviewAnswer[];
  actions: AnswerActions;
  /** What a to-do made from an item is for: "tomorrow", "next week". */
  todoFor: string;
  disabled?: boolean;
  rows?: number;
}

/**
 * A prompt and its answer: a text prompt's box, saved when it is left, or
 * a list prompt's items, each saved as it changes.
 */
const PromptAnswer: React.FunctionComponent<PromptAnswerProps> = ({
  prompt,
  answers,
  actions,
  todoFor,
  disabled = false,
  rows = 2,
}) => {
  const answer = answers[0];
  const [text, setText] = useState(answer?.body ?? "");
  useEffect(() => setText(answer?.body ?? ""), [answer?.body]);
  const id = `prompt-${prompt.id}`;

  if (prompt.style === "list") {
    return (
      <Flex vertical={true} gap={2}>
        <Text strong={true}>{prompt.label}</Text>
        <AnswerList
          label={prompt.label}
          items={answers}
          disabled={disabled}
          placeholder={prompt.placeholder}
          todoFor={todoFor}
          onAdd={(body) => actions.addAnswerItem(prompt.id, body)}
          onEdit={actions.editAnswerItem}
          onRemove={actions.removeAnswerItem}
          onReorder={(ids) => actions.reorderAnswerItems(prompt.id, ids)}
          onTodo={actions.answerItemToTodo}
        />
      </Flex>
    );
  }

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
        onBlur={() => void actions.saveAnswer(prompt.id, text)}
      />
    </Flex>
  );
};

export default PromptAnswer;
