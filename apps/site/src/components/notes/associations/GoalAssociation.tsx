import type { FullGoal } from "@ncfritz/olympus-sdk/minerva";
import { Space, Spin, Typography } from "antd";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import goalsApi from "../../../api/goalsApi";
import type { NoteAssociation } from "../../../utils/notes";
import { GoalTypeIcon } from "../../minerva/goals/GoalBits";

const { Text } = Typography;

export interface GoalNoteAssociationProps {
  item: NoteAssociation;
}

/**
 * A note's goal, among its associations: the goal's type and title,
 * linking to its page. A goal that is gone, or is not the caller's, says
 * so rather than failing the note.
 */
const GoalNoteAssociation: React.FunctionComponent<
  GoalNoteAssociationProps
> = ({ item }) => {
  const [goal, setGoal] = useState<FullGoal>();
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let live = true;
    goalsApi
      .describeGoal(item.itemId)
      .then((found) => live && setGoal(found))
      .catch(() => live && setMissing(true));
    return () => {
      live = false;
    };
  }, [item.itemId]);

  if (missing) {
    return <Text type={"secondary"}>A goal that is no longer available</Text>;
  }
  if (!goal) return <Spin size={"small"} />;
  return (
    <Space size={6}>
      <GoalTypeIcon type={goal.type} />
      <Text type={"secondary"}>Goal</Text>
      <Link href={`/minerva/goals/${goal.id}`}>{goal.title}</Link>
    </Space>
  );
};

export default GoalNoteAssociation;
