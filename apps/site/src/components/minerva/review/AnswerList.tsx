import {
  CheckSquareOutlined,
  CloseOutlined,
  HolderOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ReviewAnswer } from "@ncfritz/olympus-sdk/minerva";
import { Button, Input, Space, Tag, Tooltip, Typography } from "antd";
import React, { useEffect, useState } from "react";
import styles from "./Review.module.css";

const { Text } = Typography;

/** The longest item, as the API takes it. */
const MAX_ITEM = 200;

export interface AnswerListProps {
  /** Only show the items, as the list draws them: no changing them. */
  readOnly?: boolean;
  /** For the add box's label. */
  label: string;
  items: ReviewAnswer[];
  disabled?: boolean;
  placeholder?: string;
  /** What a to-do made from an item is for: "tomorrow", "next week". */
  todoFor: string;
  onAdd?: (body: string) => Promise<void>;
  onEdit?: (item: ReviewAnswer, body: string) => Promise<void>;
  onRemove?: (item: ReviewAnswer) => Promise<void>;
  onReorder?: (ids: string[]) => Promise<void>;
  onTodo?: (item: ReviewAnswer) => Promise<void>;
}

const AnswerRow: React.FunctionComponent<{
  item: ReviewAnswer;
  disabled: boolean;
  todoFor: string;
  onEdit: AnswerListProps["onEdit"];
  onRemove: AnswerListProps["onRemove"];
  onTodo: AnswerListProps["onTodo"];
  readOnly: boolean;
}> = ({ item, disabled, todoFor, onEdit, onRemove, onTodo, readOnly }) => {
  const sortable = useSortable({ id: item.id, disabled: disabled || readOnly });
  return (
    <div
      ref={sortable.setNodeRef}
      className={styles.row}
      style={{
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
      }}
    >
      {!readOnly && (
        <Button
          size={"small"}
          type={"text"}
          className={styles.handle}
          icon={<HolderOutlined />}
          aria-label={`Move ${item.body}`}
          disabled={disabled}
          {...sortable.attributes}
          {...sortable.listeners}
        />
      )}
      <div className={styles.rowMain}>
        <Text
          editable={
            disabled || readOnly
              ? false
              : {
                  maxLength: MAX_ITEM,
                  triggerType: ["text"],
                  onChange: (body) => {
                    if (body.trim()) void onEdit?.(item, body);
                  },
                }
          }
        >
          {item.body}
        </Text>
      </div>
      {item.editedLater && <Tag>Edited later</Tag>}
      {item.reviewItemId ? (
        <Tag color={"green"}>To-do {todoFor}</Tag>
      ) : readOnly ? null : (
        <Tooltip title={`Make it a to-do for ${todoFor}`}>
          <Button
            size={"small"}
            type={"text"}
            icon={<CheckSquareOutlined />}
            disabled={disabled}
            aria-label={`Make ${item.body} a to-do for ${todoFor}`}
            onClick={() => void onTodo?.(item)}
          />
        </Tooltip>
      )}
      {!readOnly && (
        <Button
          size={"small"}
          type={"text"}
          icon={<CloseOutlined />}
          disabled={disabled}
          aria-label={`Remove ${item.body}`}
          onClick={() => void onRemove?.(item)}
        />
      )}
    </div>
  );
};

/**
 * A list prompt's items, as the plan's lists work: add at the end, click
 * one to rewrite it, drag (or move with the keyboard) to reorder, remove,
 * and make one a to-do of the next period. Read only, it shows the rows
 * alone, with what was made a to-do.
 */
const AnswerList: React.FunctionComponent<AnswerListProps> = ({
  label,
  items,
  disabled = false,
  placeholder,
  todoFor,
  onAdd,
  onEdit,
  onRemove,
  onReorder,
  onTodo,
  readOnly = false,
}) => {
  const [order, setOrder] = useState(items);
  const [adding, setAdding] = useState("");
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  useEffect(() => setOrder(items), [items]);

  const dragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const next = arrayMove(
      order,
      order.findIndex((i) => i.id === active.id),
      order.findIndex((i) => i.id === over.id),
    );
    setOrder(next);
    void onReorder?.(next.map((i) => i.id));
  };

  const add = async () => {
    const body = adding.trim();
    if (!body || !onAdd) return;
    await onAdd(body);
    setAdding("");
  };

  return (
    <div>
      {!disabled && !readOnly && (
        <Space.Compact className={styles.addRow} block={true}>
          <Input
            value={adding}
            maxLength={MAX_ITEM}
            placeholder={placeholder ?? "Add an item"}
            aria-label={`Add to ${label}`}
            onChange={(e) => setAdding(e.target.value)}
            onPressEnter={() => void add()}
          />
          <Button
            type={"primary"}
            icon={<PlusOutlined />}
            onClick={() => void add()}
          >
            Add
          </Button>
        </Space.Compact>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={dragEnd}
      >
        <SortableContext
          items={order.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          {order.map((item) => (
            <AnswerRow
              key={item.id}
              item={item}
              disabled={disabled}
              todoFor={todoFor}
              onEdit={onEdit}
              onRemove={onRemove}
              onTodo={onTodo}
              readOnly={readOnly}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
};

export default AnswerList;
