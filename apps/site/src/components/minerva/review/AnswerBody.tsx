import type { ReviewAnswer, ReviewPrompt } from "@ncfritz/olympus-sdk/minerva";
import React from "react";
import styles from "./Review.module.css";

export interface AnswerBodyProps {
  prompt: Pick<ReviewPrompt, "style">;
  /** The prompt's answers, in their order. */
  answers: Pick<ReviewAnswer, "id" | "body">[];
}

/** An answer as it reads later: a list prompt's items, or a text answer. */
const AnswerBody: React.FunctionComponent<AnswerBodyProps> = ({
  prompt,
  answers,
}) =>
  prompt.style === "list" ? (
    <ul className={styles.answerList}>
      {answers.map((a) => (
        <li key={a.id}>{a.body}</li>
      ))}
    </ul>
  ) : (
    <span className={styles.answer}>{answers[0]?.body}</span>
  );

export default AnswerBody;
