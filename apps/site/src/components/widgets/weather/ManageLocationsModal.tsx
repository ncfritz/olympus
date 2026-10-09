import {
  CheckSquareOutlined,
  DeleteOutlined,
  HolderOutlined,
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
import {
  type BaseWeatherLocation,
  type WeatherLocation,
} from "@ncfritz/olympus-sdk/olympus";
import {
  Button,
  Empty,
  Flex,
  Input,
  message,
  Modal,
  Popconfirm,
  Typography,
} from "antd";
import { useEffect, useState } from "react";
import weatherApi from "../../../api/weatherApi";
import PlaceSearch from "./PlaceSearch";
import styles from "./WeatherWidget.module.css";

export interface ManageLocationsModalProps {
  open: boolean;
  locations: WeatherLocation[];
  onClose: () => void;
  /** Something changed; the widget reloads its locations. */
  onChanged: (added?: WeatherLocation) => Promise<void>;
}

/**
 * Adding, relabelling, ordering and removing the user's locations. Each
 * change is saved as it is made; Done only closes.
 *
 * Rows reorder by dragging their handle, with a mouse, a finger or the
 * keyboard (focus the handle, Space to pick up, arrows to move, Space to
 * drop). The new order shows at once and is saved; if saving fails it goes
 * back to what the server has.
 */
const ManageLocationsModal: React.FunctionComponent<
  ManageLocationsModalProps
> = ({ open, locations, onClose, onChanged }: ManageLocationsModalProps) => {
  const [ordered, setOrdered] = useState<WeatherLocation[]>(locations);
  const [labels, setLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    setOrdered(locations);
    setLabels(
      Object.fromEntries(
        locations.map((location) => [location.id, location.label]),
      ),
    );
  }, [locations]);

  const sensors = useSensors(
    // A few pixels of movement before a drag starts, so a click on the
    // handle is still a click.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const save = async (work: () => Promise<unknown>, failure: string) => {
    try {
      await work();
      await onChanged();
    } catch {
      message.error(failure);
      setOrdered(locations);
    }
  };

  const add = async (place: BaseWeatherLocation) => {
    try {
      const added = await weatherApi.createLocation(place);
      await onChanged(added);
    } catch {
      message.error(`Could not add ${place.label}`);
    }
  };

  const relabel = (location: WeatherLocation) => {
    const label = (labels[location.id] ?? "").trim();
    if (!label || label === location.label) {
      setLabels((all) => ({ ...all, [location.id]: location.label }));
      return;
    }
    void save(
      () => weatherApi.updateLocation(location.id, { label }),
      "Could not rename the location",
    );
  };

  const reorder = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = ordered.findIndex((location) => location.id === active.id);
    const to = ordered.findIndex((location) => location.id === over.id);
    const next = arrayMove(ordered, from, to);
    setOrdered(next);
    void save(
      () => weatherApi.reorderLocations(next.map((location) => location.id)),
      "Could not reorder the locations",
    );
  };

  return (
    <Modal
      title="Weather locations"
      open={open}
      onCancel={onClose}
      footer={
        <Flex justify="space-between" align="center" gap={12}>
          <Typography.Text type="secondary">
            Changes save as you make them.
          </Typography.Text>
          <Button type="primary" onClick={onClose}>
            Done
          </Button>
        </Flex>
      }
    >
      <Flex vertical gap={16}>
        <PlaceSearch onChoose={add} />
        {ordered.length === 0 ? (
          <Empty description="No locations yet. Search above to add one." />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={reorder}
          >
            <SortableContext
              items={ordered.map((location) => location.id)}
              strategy={verticalListSortingStrategy}
            >
              <ol className={styles.locationList} aria-label="Your locations">
                {ordered.map((location) => (
                  <LocationRow
                    key={location.id}
                    location={location}
                    label={labels[location.id] ?? location.label}
                    onLabelChange={(value) =>
                      setLabels((all) => ({ ...all, [location.id]: value }))
                    }
                    onLabelCommit={() => relabel(location)}
                    onMakeDefault={() =>
                      save(
                        () =>
                          weatherApi.updateLocation(location.id, {
                            isDefault: true,
                          }),
                        "Could not change the default",
                      )
                    }
                    onRemove={() =>
                      save(
                        () => weatherApi.deleteLocation(location.id),
                        "Could not remove the location",
                      )
                    }
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        )}
      </Flex>
    </Modal>
  );
};

interface LocationRowProps {
  location: WeatherLocation;
  label: string;
  onLabelChange: (value: string) => void;
  onLabelCommit: () => void;
  onMakeDefault: () => Promise<void>;
  onRemove: () => Promise<void>;
}

/** One location: drag handle, label, default and remove. */
const LocationRow = ({
  location,
  label,
  onLabelChange,
  onLabelCommit,
  onMakeDefault,
  onRemove,
}: LocationRowProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: location.id });

  return (
    <li
      ref={setNodeRef}
      className={`${styles.locationRow} ${isDragging ? styles.locationRowDragging : ""}`}
      // dnd-kit moves the row by transform while it is dragged.
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <Button
        ref={setActivatorNodeRef}
        type="text"
        className={styles.dragHandle}
        icon={<HolderOutlined />}
        aria-label={`Reorder ${location.label}`}
        {...attributes}
        {...listeners}
      />
      <Input
        aria-label={`Label for ${location.label}`}
        value={label}
        maxLength={100}
        onChange={(event) => onLabelChange(event.target.value)}
        onBlur={onLabelCommit}
        onPressEnter={onLabelCommit}
      />
      {location.isDefault ? (
        <Button
          color="green"
          variant="solid"
          icon={<CheckSquareOutlined />}
          aria-pressed
          aria-label={`${location.label} is the default`}
        >
          Default
        </Button>
      ) : (
        <Button
          color="green"
          variant="text"
          aria-pressed={false}
          aria-label={`Make ${location.label} the default`}
          onClick={() => void onMakeDefault()}
        >
          Default
        </Button>
      )}
      <Popconfirm
        title={`Remove ${location.label}?`}
        okText="Remove"
        okButtonProps={{ danger: true }}
        onConfirm={onRemove}
      >
        <Button
          danger
          icon={<DeleteOutlined />}
          aria-label={`Remove ${location.label}`}
        />
      </Popconfirm>
      {location.placeName && (
        // Under the label, in the second column, so the controls above it
        // stay on one line with the label.
        <span className={`${styles.muted} ${styles.placeName}`}>
          {location.placeName}
        </span>
      )}
    </li>
  );
};

export default ManageLocationsModal;
