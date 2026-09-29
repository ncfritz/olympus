import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import {
  type BaseWeatherLocation,
  type WeatherLocation,
} from "@ncfritz/olympus-sdk/olympus";
import {
  Button,
  Flex,
  Input,
  List,
  message,
  Modal,
  Popconfirm,
  Radio,
  Typography,
} from "antd";
import { useEffect, useState } from "react";
import weatherApi from "../../../api/weatherApi";
import { moveItem } from "../../../utils/weather";
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
 * The design drew a drag handle; this uses move up and down buttons, which a
 * keyboard can drive and which need no drag library.
 */
const ManageLocationsModal: React.FunctionComponent<
  ManageLocationsModalProps
> = ({ open, locations, onClose, onChanged }: ManageLocationsModalProps) => {
  const [labels, setLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    setLabels(
      Object.fromEntries(
        locations.map((location) => [location.id, location.label]),
      ),
    );
  }, [locations]);

  const save = async (work: () => Promise<unknown>, failure: string) => {
    try {
      await work();
      await onChanged();
    } catch {
      message.error(failure);
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

  const move = (from: number, to: number) =>
    save(
      () =>
        weatherApi.reorderLocations(
          moveItem(locations, from, to).map((location) => location.id),
        ),
      "Could not reorder the locations",
    );

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
        <Radio.Group
          value={locations.find((location) => location.isDefault)?.id}
          onChange={(event) =>
            void save(
              () =>
                weatherApi.updateLocation(event.target.value, {
                  isDefault: true,
                }),
              "Could not change the default",
            )
          }
        >
          <List
            dataSource={locations}
            locale={{ emptyText: "No locations yet. Search above to add one." }}
            renderItem={(location, index) => (
              <List.Item>
                <div className={styles.locationRow}>
                  <Flex vertical>
                    <Button
                      type="text"
                      size="small"
                      icon={<ArrowUpOutlined />}
                      aria-label={`Move ${location.label} up`}
                      disabled={index === 0}
                      onClick={() => void move(index, index - 1)}
                    />
                    <Button
                      type="text"
                      size="small"
                      icon={<ArrowDownOutlined />}
                      aria-label={`Move ${location.label} down`}
                      disabled={index === locations.length - 1}
                      onClick={() => void move(index, index + 1)}
                    />
                  </Flex>
                  <div className={styles.locationLabel}>
                    <Input
                      aria-label={`Label for ${location.label}`}
                      value={labels[location.id] ?? location.label}
                      maxLength={100}
                      onChange={(event) =>
                        setLabels((all) => ({
                          ...all,
                          [location.id]: event.target.value,
                        }))
                      }
                      onBlur={() => relabel(location)}
                      onPressEnter={() => relabel(location)}
                    />
                    {location.placeName && (
                      <span className={styles.muted}>{location.placeName}</span>
                    )}
                  </div>
                  <Radio
                    value={location.id}
                    aria-label={`Make ${location.label} the default`}
                  >
                    Default
                  </Radio>
                  <Popconfirm
                    title={`Remove ${location.label}?`}
                    okText="Remove"
                    onConfirm={() =>
                      save(
                        () => weatherApi.deleteLocation(location.id),
                        "Could not remove the location",
                      )
                    }
                  >
                    <Button
                      type="text"
                      icon={<DeleteOutlined />}
                      aria-label={`Remove ${location.label}`}
                    />
                  </Popconfirm>
                </div>
              </List.Item>
            )}
          />
        </Radio.Group>
      </Flex>
    </Modal>
  );
};

export default ManageLocationsModal;
