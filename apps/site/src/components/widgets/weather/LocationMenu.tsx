import {
  CheckOutlined,
  DownOutlined,
  EnvironmentOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { type WeatherLocation } from "@ncfritz/olympus-sdk/olympus";
import { Button, Dropdown, Tag } from "antd";

export interface LocationMenuProps {
  locations: WeatherLocation[];
  selectedId?: string;
  onSelect: (locationId: string) => void;
  onManage: () => void;
}

const MANAGE = "manage";

/** The header's location switcher: the user's places, then managing them. */
const LocationMenu: React.FunctionComponent<LocationMenuProps> = ({
  locations,
  selectedId,
  onSelect,
  onManage,
}: LocationMenuProps) => {
  const selected = locations.find((location) => location.id === selectedId);
  return (
    <Dropdown
      trigger={["click"]}
      placement="bottomRight"
      menu={{
        selectable: true,
        selectedKeys: selectedId ? [selectedId] : [],
        onClick: ({ key }) => (key === MANAGE ? onManage() : onSelect(key)),
        items: [
          ...locations.map((location) => ({
            key: location.id,
            icon: location.id === selectedId ? <CheckOutlined /> : <span />,
            label: (
              <>
                {location.label}
                {location.isDefault && <Tag bordered={false}>Default</Tag>}
              </>
            ),
          })),
          ...(locations.length > 0 ? [{ type: "divider" as const }] : []),
          {
            key: MANAGE,
            icon: <PlusOutlined />,
            label: "Add or manage locations…",
          },
        ],
      }}
    >
      <Button
        icon={<EnvironmentOutlined />}
        aria-label={`Location: ${selected?.label ?? "none"}. Change location`}
      >
        {selected?.label ?? "Locations"} <DownOutlined />
      </Button>
    </Dropdown>
  );
};

export default LocationMenu;
