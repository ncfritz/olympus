import { HolderOutlined, PlusOutlined } from "@ant-design/icons";
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
import type { Goal, GoalCategory } from "@ncfritz/olympus-sdk/minerva";
import {
  Button,
  Card,
  ColorPicker,
  Drawer,
  Flex,
  Input,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Typography,
} from "antd";
import React, { useEffect, useState } from "react";
import goalsApi from "../../../api/goalsApi";
import { apiProblems } from "../../../utils/goals";
import IconPicker from "./IconPicker";

const { Text } = Typography;

export interface CategoriesDrawerProps {
  open: boolean;
  categories: GoalCategory[];
  /** Every goal of the caller's, to say what a delete would move. */
  goals: Goal[];
  onClose: () => void;
  onChanged: () => Promise<void>;
}

/** One category, edited in place; each change saves when the field is left. */
const CategoryRow: React.FunctionComponent<{
  category: GoalCategory;
  others: GoalCategory[];
  goalCount: number;
  onChanged: () => Promise<void>;
}> = ({ category, others, goalCount, onChanged }) => {
  const sortable = useSortable({ id: category.id });
  const [name, setName] = useState(category.name);
  const [vision, setVision] = useState(category.vision ?? "");
  const [moveTo, setMoveTo] = useState<string>();
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setName(category.name);
    setVision(category.vision ?? "");
  }, [category]);

  const save = async (
    changes: Parameters<typeof goalsApi.updateCategory>[1],
  ) => {
    try {
      await goalsApi.updateCategory(category.id, changes);
      await onChanged();
    } catch (error) {
      message.error(apiProblems(error).join("; "));
    }
  };

  const remove = async () => {
    try {
      await goalsApi.deleteCategory(
        category.id,
        goalCount ? moveTo : undefined,
      );
      setDeleting(false);
      await onChanged();
    } catch (error) {
      message.error(apiProblems(error).join("; "));
    }
  };

  return (
    <div
      ref={sortable.setNodeRef}
      style={{
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
      }}
    >
      <Card
        size={"small"}
        style={{
          // As a note's coloured edge: the radius no wider than the border,
          // so its inner side stays straight.
          borderLeft: `5px solid ${category.color}`,
          borderRadius: 4,
          opacity: category.archived ? 0.6 : 1,
        }}
      >
        <Flex gap={8} align={"start"}>
          <Button
            type={"text"}
            size={"small"}
            icon={<HolderOutlined />}
            aria-label={`Move ${category.name}`}
            {...sortable.attributes}
            {...sortable.listeners}
            style={{ cursor: "grab" }}
          />
          <Space orientation={"vertical"} style={{ flex: 1 }} size={8}>
            <Flex gap={8}>
              <ColorPicker
                size={"small"}
                value={category.color}
                disabledAlpha={true}
                onChangeComplete={(c) => save({ color: c.toHexString() })}
                aria-label={`${category.name} colour`}
              />
              <IconPicker
                value={category.icon}
                color={category.color}
                label={`${category.name} icon`}
                onChange={(icon) => save({ icon })}
              />
              <Input
                size={"small"}
                value={name}
                maxLength={50}
                aria-label={"Name"}
                onChange={(e) => setName(e.target.value)}
                onBlur={() =>
                  name.trim() && name !== category.name
                    ? save({ name: name.trim() })
                    : setName(category.name)
                }
              />
            </Flex>
            <Input.TextArea
              size={"small"}
              value={vision}
              maxLength={2000}
              autoSize={{ minRows: 1, maxRows: 4 }}
              placeholder={"A vision line: where this part of life is headed"}
              aria-label={`${category.name} vision`}
              onChange={(e) => setVision(e.target.value)}
              onBlur={() =>
                vision !== (category.vision ?? "") &&
                save({ vision: (vision.trim() || null) as string })
              }
            />
            <Flex justify={"space-between"} align={"center"}>
              <Space>
                <Switch
                  size={"small"}
                  checked={category.archived}
                  onChange={(archived) => save({ archived })}
                  aria-label={`Archive ${category.name}`}
                />
                <Text type={"secondary"}>
                  {category.archived ? "Archived" : "In use"} · {goalCount} goal
                  {goalCount === 1 ? "" : "s"}
                </Text>
              </Space>
              {goalCount === 0 ? (
                <Popconfirm
                  title={`Delete ${category.name}?`}
                  okText={"Delete"}
                  okButtonProps={{ danger: true }}
                  onConfirm={remove}
                >
                  <Button size={"small"} danger={true} type={"text"}>
                    Delete
                  </Button>
                </Popconfirm>
              ) : (
                <Button
                  size={"small"}
                  danger={true}
                  type={"text"}
                  onClick={() => setDeleting(true)}
                >
                  Delete
                </Button>
              )}
            </Flex>
          </Space>
        </Flex>
      </Card>
      <Modal
        open={deleting}
        title={`Delete ${category.name}?`}
        okText={"Move goals and delete"}
        okButtonProps={{ danger: true, disabled: !moveTo }}
        onOk={remove}
        onCancel={() => setDeleting(false)}
      >
        <p>
          {goalCount} goal{goalCount === 1 ? "" : "s"} sit in {category.name}.
          Choose where they go.
        </p>
        <Select
          size={"small"}
          style={{ width: "100%" }}
          value={moveTo}
          onChange={setMoveTo}
          placeholder={"Move them to"}
          options={others.map((c) => ({ value: c.id, label: c.name }))}
        />
      </Modal>
    </div>
  );
};

/**
 * Manage categories: reorder by dragging, colour, icon, name and vision
 * line, archive, delete (moving any goals first), and add.
 */
const CategoriesDrawer: React.FunctionComponent<CategoriesDrawerProps> = ({
  open,
  categories,
  goals,
  onClose,
  onChanged,
}) => {
  const [order, setOrder] = useState(categories);
  const [adding, setAdding] = useState("");
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => setOrder(categories), [categories]);

  const dragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = order.findIndex((c) => c.id === active.id);
    const to = order.findIndex((c) => c.id === over.id);
    const next = arrayMove(order, from, to);
    setOrder(next);
    try {
      await goalsApi.reorderCategories(next.map((c) => c.id));
      await onChanged();
    } catch {
      message.error("Could not save the new order");
      setOrder(categories);
    }
  };

  const add = async () => {
    const name = adding.trim();
    if (!name) return;
    try {
      await goalsApi.createCategory({ name, color: "#1677ff", icon: "star" });
      setAdding("");
      await onChanged();
    } catch (error) {
      message.error(apiProblems(error).join("; "));
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={"Manage categories"}
      size={480}
    >
      {/* Stays at the top while the list scrolls beneath it. */}
      <div
        style={{
          position: "sticky",
          top: -24,
          zIndex: 2,
          background: "#ffffff",
          margin: "-24px -24px 16px",
          padding: "16px 24px",
          borderBottom: "1px solid #f0f0f0",
        }}
      >
        <Space.Compact style={{ width: "100%" }}>
          <Input
            size={"small"}
            value={adding}
            maxLength={50}
            placeholder={"New category"}
            onChange={(e) => setAdding(e.target.value)}
            onPressEnter={add}
          />
          <Button size={"small"} icon={<PlusOutlined />} onClick={add}>
            Add
          </Button>
        </Space.Compact>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={dragEnd}
      >
        <SortableContext
          items={order.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          <Space orientation={"vertical"} style={{ width: "100%" }}>
            {order.map((category) => (
              <CategoryRow
                key={category.id}
                category={category}
                others={categories.filter(
                  (c) => c.id !== category.id && !c.archived,
                )}
                goalCount={
                  goals.filter((g) => g.categoryId === category.id).length
                }
                onChanged={onChanged}
              />
            ))}
          </Space>
        </SortableContext>
      </DndContext>
    </Drawer>
  );
};

export default CategoriesDrawer;
