import { Drawer } from "antd";
import SettingsPanel from "./SettingsPanel";

export interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
}

const SettingsDrawer: React.FunctionComponent<SettingsDrawerProps> = ({
  open,
  onClose,
}: SettingsDrawerProps) => {
  return (
    <Drawer
      title={"Settings"}
      placement={"right"}
      width={450}
      onClose={() => {
        onClose();
      }}
      open={open}
      styles={{
        body: {
          padding: 0,
        },
      }}
    >
      <SettingsPanel />
    </Drawer>
  );
};
export default SettingsDrawer;
