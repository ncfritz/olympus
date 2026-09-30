import { type WeatherStation } from "@ncfritz/olympus-sdk/olympus";
import { Alert, Form, Input, message, Modal } from "antd";
import { useState } from "react";
import weatherApi from "../../../api/weatherApi";
import {
  apiErrorMessage,
  MAX_STATION_NAME,
  normalizeMac,
} from "../../../utils/stations";

export interface RegisterStationModalProps {
  open: boolean;
  onClose: () => void;
  /** The station was registered; the Stations tab reloads. */
  onRegistered: (station: WeatherStation) => void;
}

type Fields = { name: string; macAddress: string };

/**
 * Registering a console (CreateWeatherStation, admins only;
 * docs/guides/weather-stations.md, step 2). Its MAC address is its identity:
 * the console sends it as PASSKEY, and until it is registered every push is
 * refused. The API's own refusal (a MAC already registered, say) shows in
 * the modal, which stays open.
 */
const RegisterStationModal: React.FunctionComponent<
  RegisterStationModalProps
> = ({ open, onClose, onRegistered }: RegisterStationModalProps) => {
  const [form] = Form.useForm<Fields>();
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | undefined>();

  const register = async ({ name, macAddress }: Fields) => {
    setSaving(true);
    setFailure(undefined);
    try {
      const station = await weatherApi.createStation({
        name: name.trim(),
        macAddress: normalizeMac(macAddress)!,
      });
      message.success(`Registered ${station.name}`);
      onRegistered(station);
      onClose();
    } catch (error) {
      setFailure(
        apiErrorMessage(error) ?? "The station could not be registered",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Register a weather station"
      open={open}
      okText="Register"
      confirmLoading={saving}
      onOk={() => form.submit()}
      onCancel={onClose}
      afterClose={() => {
        form.resetFields();
        setFailure(undefined);
      }}
      destroyOnHidden
    >
      <Form<Fields>
        form={form}
        layout="vertical"
        requiredMark={false}
        onFinish={(fields) => void register(fields)}
        onValuesChange={() => setFailure(undefined)}
      >
        <Form.Item
          name="name"
          label="Name"
          extra="As the Stations tab shows it."
          rules={[
            {
              required: true,
              whitespace: true,
              message: "Give the station a name",
            },
            {
              max: MAX_STATION_NAME,
              message: `At most ${MAX_STATION_NAME} characters`,
            },
          ]}
        >
          <Input placeholder="Mill Creek" autoFocus />
        </Form.Item>
        <Form.Item
          name="macAddress"
          label="Console MAC address"
          extra="The console sends it as PASSKEY. On a WS-5000: Settings → Wi-Fi → Status."
          rules={[
            { required: true, message: "The console's MAC address" },
            {
              validator: async (_rule, value: string | undefined) => {
                if (value && !normalizeMac(value)) {
                  throw new Error("A MAC address, e.g. A0:B1:C2:D3:E4:F5");
                }
              },
            },
          ]}
        >
          <Input
            placeholder="A0:B1:C2:D3:E4:F5"
            spellCheck={false}
            autoComplete="off"
          />
        </Form.Item>
        {failure && <Alert type="error" showIcon message={failure} />}
      </Form>
    </Modal>
  );
};

export default RegisterStationModal;
