import { Drawer } from "antd";
import NotificationsPanel from "./NotificationsPanel";

export interface NotificationsDrawerProps {
  open: boolean;
  onClose: () => void;
}

const NotificationsDrawer: React.FunctionComponent<
  NotificationsDrawerProps
> = ({ open, onClose }: NotificationsDrawerProps) => {
  return (
    <Drawer
      title={"Notifications"}
      placement={"right"}
      width={650}
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
      <NotificationsPanel />
    </Drawer>
  );
};
export default NotificationsDrawer;
