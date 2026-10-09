import { CloseOutlined, HolderOutlined, PlusOutlined } from "@ant-design/icons";
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
import type { ReviewItem, ReviewItemKind } from "@ncfritz/olympus-sdk/minerva";
import { Button, Input, Space, Tag, Typography } from "antd";
import React, { useEffect, useState } from "react";
import { formatBlock, placeLabel } from "../../../utils/reviews";
import { PLAN_KINDS } from "./planKinds";
import styles from "./Review.module.css";

const { Text } = Typography;

export interface PlanListProps {
  kind: ReviewItemKind;
  items: ReviewItem[];
  disabled?: boolean;
  /** Whether to show an item's block of time, set on the calendar. */
  blocks?: boolean;
  /** Whether the block's time says its day too, as a week's items do. */
  blockDay?: boolean;
  /**
   * Whether an item's title can be dragged onto a calendar to block its
   * time: it carries `data-block-item` for a FullCalendar Draggable.
   */
  calendarDrag?: boolean;
  placeholder?: string;
  onAdd?: (title: string) => Promise<void>;
  onRemove?: (item: ReviewItem) => Promise<void>;
  onReorder?: (ids: string[]) => Promise<void>;
  /** Only show the items, as the list draws them: no adding, moving or removing. */
  readOnly?: boolean;
  /** Anything more a row shows before its remove button. */
  extra?: (item: ReviewItem) => React.ReactNode;
}

const PlanRow: React.FunctionComponent<{
  item: ReviewItem;
  rank?: number;
  disabled: boolean;
  onRemove: PlanListProps["onRemove"];
  showBlock: boolean;
  blockDay: boolean;
  extra?: PlanListProps["extra"];
  calendarDrag: boolean;
  readOnly: boolean;
}> = ({
  item,
  rank,
  disabled,
  onRemove,
  showBlock,
  blockDay,
  extra,
  calendarDrag,
  readOnly,
}) => {
  const kind = PLAN_KINDS[item.kind];
  const block = blockDay
    ? placeLabel(item)
    : formatBlock(item.scheduledStart, item.scheduledEnd);
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
          aria-label={`Move ${item.title}`}
          disabled={disabled}
          {...sortable.attributes}
          {...sortable.listeners}
        />
      )}
      {rank !== undefined && <span className={styles.rank}>{rank}</span>}
      <span className={kind.tint} title={kind.label}>
        {kind.icon}
      </span>
      <div className={styles.rowMain}>
        {calendarDrag && !disabled && !readOnly ? (
          <Text
            className={styles.blockSource}
            data-block-item={item.id}
            data-kind={item.kind}
            title={"Drag onto the calendar to block time for it"}
          >
            {item.title}
          </Text>
        ) : (
          <Text>{item.title}</Text>
        )}
      </div>
      {item.carryCount > 0 && <Tag color={"orange"}>Carried over</Tag>}
      {showBlock && block && (
        <span className={styles.blockTime} title={"Blocked on the calendar"}>
          {block}
        </span>
      )}
      {extra?.(item)}
      {!readOnly && (
        <Button
          size={"small"}
          type={"text"}
          icon={<CloseOutlined />}
          disabled={disabled}
          aria-label={`Remove ${item.title}`}
          onClick={() => void onRemove?.(item)}
        />
      )}
    </div>
  );
};

/**
 * The next period's priorities or to-dos: drag (or move with the keyboard) to
 * reorder, add at the end from the box at the top, remove, and show the time an
 * item has blocked, which is set by dragging its title onto the calendar.
 * Read only, it shows the rows alone.
 */
const PlanList: React.FunctionComponent<PlanListProps> = ({
  kind,
  items,
  disabled = false,
  blocks = false,
  blockDay = false,
  calendarDrag = false,
  placeholder,
  onAdd,
  onRemove,
  onReorder,
  readOnly = false,
  extra,
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
    const title = adding.trim();
    if (!title || !onAdd) return;
    await onAdd(title);
    setAdding("");
  };

  return (
    <div>
      {!disabled && !readOnly && (
        <Space.Compact className={styles.addRow} block={true}>
          <Input
            value={adding}
            maxLength={200}
            placeholder={placeholder}
            aria-label={placeholder}
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
          {order.map((item, index) => (
            <PlanRow
              key={item.id}
              item={item}
              rank={kind === "priority" ? index + 1 : undefined}
              disabled={disabled}
              onRemove={onRemove}
              showBlock={blocks}
              blockDay={blockDay}
              extra={extra}
              calendarDrag={calendarDrag}
              readOnly={readOnly}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
};

export default PlanList;
