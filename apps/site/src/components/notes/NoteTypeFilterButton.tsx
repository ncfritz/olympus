import { Button } from "antd";
import React from "react";
import {
  config,
  getColorForType,
  getIconForType,
  getSecondaryColorForType,
} from "../../utils/notes";

export interface NoteTypeFilterButtonProps {
  noteType: number;
  onToggle: (noteType: string) => void;
  typeFilters: Record<string, boolean>;
}

const NoteTypeFilterButton: React.FunctionComponent<
  NoteTypeFilterButtonProps
> = ({ noteType, onToggle, typeFilters }: NoteTypeFilterButtonProps) => {
  const color = getColorForType(noteType);
  const active = typeFilters[config[noteType].type];

  return (
    <Button
      icon={getIconForType(noteType)}
      size={"middle"}
      onClick={() => {
        onToggle(config[noteType].type);
      }}
      style={{
        width: `${(1 / 6) * 100}%`,
        color: `${active ? color : getSecondaryColorForType(noteType)}`,
        backgroundColor: `${active ? getSecondaryColorForType(noteType) : color}`,
      }}
    />
  );
};
export default NoteTypeFilterButton;
