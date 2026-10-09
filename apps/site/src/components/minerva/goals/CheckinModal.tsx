import type { Goal } from "@ncfritz/olympus-sdk/minerva";
import { Modal } from "antd";
import React from "react";
import CheckinForm from "./CheckinForm";

/** The check-in form on its own, from a list row. */
const CheckinModal: React.FunctionComponent<{
  goal?: Goal;
  onClose: () => void;
  onSaved: () => void;
}> = ({ goal, onClose, onSaved }) => (
  <Modal
    open={goal !== undefined}
    title={goal ? `Check in · ${goal.title}` : undefined}
    footer={null}
    onCancel={onClose}
    destroyOnHidden={true}
  >
    {goal && (
      <CheckinForm
        goal={goal}
        onSaved={() => {
          onSaved();
          onClose();
        }}
      />
    )}
  </Modal>
);

export default CheckinModal;
