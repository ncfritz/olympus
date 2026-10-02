import { CaretRightOutlined } from "@ant-design/icons";
import { Collapse } from "antd";
import { useState } from "react";
import * as React from "react";
import type { Note, NoteAssociation } from "@ncfritz/olympus-sdk/minerva";
import GoalNoteAssociation from "./associations/GoalAssociation";
import MeetingAssociation from "./associations/MeetingAssociation";

export interface NoteAssociationsProps {
  note: Note;
}

const getAssociationElement = (association: NoteAssociation, open: boolean) => {
  switch (association.itemType) {
    case "meeting":
      return <MeetingAssociation open={open} item={association} />;
    case "goal":
      return (
        <GoalNoteAssociation
          key={`${association.itemType}-${association.itemId}`}
          item={association}
        />
      );
    default:
      return <>Nope</>;
  }
};

const NoteAssociations: React.FunctionComponent<NoteAssociationsProps> = ({
  note,
}: NoteAssociationsProps) => {
  if (!note.associations) {
    return;
  }

  const [open] = useState(false);

  let content = <></>;

  if (note.associations.length > 1) {
    content = (
      <Collapse
        ghost={true}
        onChange={(key) => {
          console.log(key);
        }}
        expandIcon={({ isActive }) => (
          <CaretRightOutlined rotate={isActive ? 90 : 0} />
        )}
        items={[
          {
            key: `associsations-${note.id}`,
            label: "Associations",
            children: note.associations.map((association) => {
              return getAssociationElement(association, open);
            }),
          },
        ]}
        style={{
          width: "100%",
        }}
      />
    );
  } else if (note.associations.length > 0) {
    content = getAssociationElement(note.associations[0], true);
  }

  return content;
};
export default NoteAssociations;
