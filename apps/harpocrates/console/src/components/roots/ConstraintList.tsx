"use client";

import {
  CloseCircleOutlined,
  EditOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { Button, Input, Select, Space, Tooltip, Typography } from "antd";
import { useState } from "react";
import {
  CONSTRAINT_TYPES,
  type Constraint,
  type ConstraintType,
  constraintProblem,
} from "@/lib/rootRequest";
import styles from "./RootSettings.module.css";

const labelOf = (type: ConstraintType) =>
  CONSTRAINT_TYPES.find((t) => t.value === type)!.label;

/** Why a value would not do, its type's or a repeat's. */
const problemOf = (
  list: Constraint[],
  type: ConstraintType,
  value: string,
  except?: number,
) =>
  constraintProblem(type, value) ??
  (list.some((c, i) => i !== except && c.type === type && c.value === value)
    ? "Already in the list"
    : undefined);

/** One constraint: its type and value, edited in place. */
function Item({
  constraint,
  list,
  index,
  onChange,
  onRemove,
}: {
  constraint: Constraint;
  list: Constraint[];
  index: number;
  onChange: (value: string) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState<string>();
  const problem =
    editing !== undefined && editing.trim()
      ? problemOf(list, constraint.type, editing.trim(), index)
      : undefined;
  const save = () => {
    if (editing === undefined) return;
    const value = editing.trim();
    if (value && !problemOf(list, constraint.type, value, index)) {
      onChange(value);
    }
    setEditing(undefined);
  };
  return (
    <li className={styles.item}>
      <span className={styles.itemType}>{labelOf(constraint.type)}</span>
      {editing === undefined ? (
        <>
          <span className={styles.itemValue}>{constraint.value}</span>
          <Tooltip title="Edit">
            <Button
              type="text"
              size="small"
              className={styles.itemEdit}
              icon={<EditOutlined />}
              aria-label={`Edit ${constraint.value}`}
              onClick={() => setEditing(constraint.value)}
            />
          </Tooltip>
        </>
      ) : (
        <Tooltip title={problem} open={Boolean(problem)}>
          <Input
            size="small"
            autoFocus
            value={editing}
            status={problem ? "error" : undefined}
            className={styles.itemInput}
            aria-label={`Edit ${constraint.value}`}
            onChange={(event) => setEditing(event.target.value)}
            onPressEnter={save}
            onBlur={save}
            onKeyDown={(event) => {
              if (event.key === "Escape") setEditing(undefined);
            }}
          />
        </Tooltip>
      )}
      <Tooltip title="Remove">
        <Button
          type="text"
          size="small"
          icon={<CloseCircleOutlined />}
          aria-label={`Remove ${constraint.value}`}
          onClick={onRemove}
        />
      </Tooltip>
    </li>
  );
}

/**
 * A list of name constraints of one kind (permitted or excluded), as a
 * form control: a type and a value to add, checked as RFC 5280 writes
 * that type's subtree; those added beneath, each removed with its close
 * icon or, on hover, edited in place.
 */
export function ConstraintList({
  value = [],
  onChange,
  label,
}: {
  value?: Constraint[];
  onChange?: (value: Constraint[]) => void;
  /** Which list, for the controls' names: Permitted, Excluded. */
  label: string;
}) {
  const [type, setType] = useState<ConstraintType>("dns");
  const [draft, setDraft] = useState("");
  const [tried, setTried] = useState(false);
  const entry = draft.trim();
  const problem = entry ? problemOf(value, type, entry) : undefined;
  const add = () => {
    setTried(true);
    if (!entry || problem) return;
    onChange?.([...value, { type, value: entry }]);
    setDraft("");
    setTried(false);
  };
  return (
    <div className={styles.constraints}>
      <Space.Compact block>
        <Select<ConstraintType>
          value={type}
          onChange={setType}
          className={styles.constraintType}
          aria-label={`${label}: name type`}
          options={CONSTRAINT_TYPES.map((t) => ({
            value: t.value,
            label: t.label,
          }))}
        />
        <Input
          value={draft}
          className={styles.mono}
          placeholder={
            CONSTRAINT_TYPES.find((t) => t.value === type)!.placeholder
          }
          status={problem && (tried || entry.length > 3) ? "error" : undefined}
          aria-label={`${label}: name`}
          onChange={(event) => setDraft(event.target.value)}
          onPressEnter={add}
        />
        <Button icon={<PlusOutlined />} onClick={add} disabled={!entry}>
          Add
        </Button>
      </Space.Compact>
      {problem && (tried || entry.length > 3) && (
        <Typography.Text type="danger" className={styles.small}>
          {problem}
        </Typography.Text>
      )}
      {value.length > 0 && (
        <ul className={styles.items} aria-label={label}>
          {value.map((constraint, index) => (
            <Item
              key={`${constraint.type}:${constraint.value}`}
              constraint={constraint}
              list={value}
              index={index}
              onChange={(next) =>
                onChange?.(
                  value.map((c, i) =>
                    i === index ? { ...c, value: next } : c,
                  ),
                )
              }
              onRemove={() => onChange?.(value.filter((_, i) => i !== index))}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
