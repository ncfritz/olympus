import {
  ClockCircleOutlined,
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
import type { ReviewItem, ReviewItemKind } from "@ncfritz/olympus-sdk/minerva";
import {
  Button,
  Input,
  Popover,
  Space,
  Tag,
  TimePicker,
  Typography,
} from "antd";
import dayjs, { type Dayjs } from "dayjs";
import React, { useEffect, useState } from "react";
import { formatBlock } from "../../../utils/reviews";
import styles from "./Review.module.css";

const { Text } = Typography;

export interface PlanListProps {
  kind: ReviewItemKind;
  items: ReviewItem[];
  disabled?: boolean;
  /** Whether items can be given a block of time (priorities). */
  blocks?: boolean;
  placeholder: string;
  onAdd: (title: string) => Promise<void>;
  onRemove: (item: ReviewItem) => Promise<void>;
  onReorder: (ids: string[]) => Promise<void>;
  onBlock?: (
    item: ReviewItem,
    block: { start: string; end: string } | null,
  ) => Promise<void>;
  /** Anything more a row shows before its remove button. */
  extra?: (item: ReviewItem) => React.ReactNode;
}

/** Picks a block of time for an item, on its day. */
const BlockPicker: React.FunctionComponent<{
  item: ReviewItem;
  onBlock: NonNullable<PlanListProps["onBlock"]>;
  disabled: boolean;
}> = ({ item, onBlock, disabled }) => {
  const [open, setOpen] = useState(false);
  const block = formatBlock(item.scheduledStart, item.scheduledEnd);
  const at = (clock?: string) => (clock ? dayjs(clock, "HH:mm") : null);
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger={"click"}
      title={"Block time for it"}
      content={
        <Space orientation={"vertical"}>
          <TimePicker.RangePicker
            format={"HH:mm"}
            minuteStep={15}
            needConfirm={false}
            value={[at(item.scheduledStart), at(item.scheduledEnd)]}
            onChange={(range) => {
              const [start, end] = (range ?? []) as (Dayjs | null)[];
              if (start && end) {
                void onBlock(item, {
                  start: start.format("HH:mm"),
                  end: end.format("HH:mm"),
                }).then(() => setOpen(false));
              }
            }}
          />
          {block && (
            <Button
              size={"small"}
              onClick={() =>
                void onBlock(item, null).then(() => setOpen(false))
              }
            >
              Clear the block
            </Button>
          )}
        </Space>
      }
    >
      <Button
        size={"small"}
        type={block ? "default" : "text"}
        icon={<ClockCircleOutlined />}
        disabled={disabled}
        aria-label={block ? `Blocked ${block}; change` : "Block time"}
      >
        {block}
      </Button>
    </Popover>
  );
};

const PlanRow: React.FunctionComponent<{
  item: ReviewItem;
  rank?: number;
  disabled: boolean;
  onRemove: PlanListProps["onRemove"];
  onBlock?: PlanListProps["onBlock"];
  extra?: PlanListProps["extra"];
}> = ({ item, rank, disabled, onRemove, onBlock, extra }) => {
  const sortable = useSortable({ id: item.id, disabled });
  return (
    <div
      ref={sortable.setNodeRef}
      className={styles.row}
      style={{
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
      }}
    >
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
      {rank !== undefined && <span className={styles.rank}>{rank}</span>}
      <div className={styles.rowMain}>
        <Text>{item.title}</Text>
      </div>
      {item.carryCount > 0 && <Tag color={"orange"}>Carried over</Tag>}
      {onBlock && (
        <BlockPicker item={item} onBlock={onBlock} disabled={disabled} />
      )}
      {extra?.(item)}
      <Button
        size={"small"}
        type={"text"}
        icon={<CloseOutlined />}
        disabled={disabled}
        aria-label={`Remove ${item.title}`}
        onClick={() => void onRemove(item)}
      />
    </div>
  );
};

/**
 * The next period's priorities or to-dos: drag (or move with the keyboard) to
 * reorder, add at the end, remove, and give a priority a block of time.
 */
const PlanList: React.FunctionComponent<PlanListProps> = ({
  kind,
  items,
  disabled = false,
  blocks = false,
  placeholder,
  onAdd,
  onRemove,
  onReorder,
  onBlock,
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
    void onReorder(next.map((i) => i.id));
  };

  const add = async () => {
    const title = adding.trim();
    if (!title) return;
    await onAdd(title);
    setAdding("");
  };

  return (
    <div>
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
              onBlock={blocks ? onBlock : undefined}
              extra={extra}
            />
          ))}
        </SortableContext>
      </DndContext>
      {!disabled && (
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
    </div>
  );
};

export default PlanList;
