import type { GoalCategoryIcon } from "@ncfritz/olympus-sdk/minerva";
import { Button, Popover, Tooltip } from "antd";
import React, { useState } from "react";
import { CATEGORY_ICONS, CategoryIcon } from "./GoalBits";

const ICONS = Object.keys(CATEGORY_ICONS) as GoalCategoryIcon[];

/** Words for an icon's key, e.g. medicine-box as "Medicine box". */
const words = (icon: string) =>
  `${icon[0].toUpperCase()}${icon.slice(1).replace(/-/g, " ")}`;

/** A category's icon, picked from a grid of them. */
const IconPicker: React.FunctionComponent<{
  value: GoalCategoryIcon;
  color?: string;
  onChange: (icon: GoalCategoryIcon) => void;
  label: string;
}> = ({ value, color, onChange, label }) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger={"click"}
      placement={"bottomLeft"}
      content={
        <div
          role={"listbox"}
          aria-label={label}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(8, 28px)",
            gap: 4,
          }}
        >
          {ICONS.map((icon) => (
            <Tooltip key={icon} title={words(icon)} mouseEnterDelay={0.4}>
              <Button
                size={"small"}
                type={icon === value ? "primary" : "text"}
                role={"option"}
                aria-selected={icon === value}
                aria-label={words(icon)}
                icon={<CategoryIcon icon={icon} />}
                onClick={() => {
                  setOpen(false);
                  if (icon !== value) onChange(icon);
                }}
              />
            </Tooltip>
          ))}
        </div>
      }
    >
      <Button
        size={"small"}
        aria-label={`${label}: ${words(value)}`}
        icon={<CategoryIcon icon={value} color={color} />}
      />
    </Popover>
  );
};

export default IconPicker;
