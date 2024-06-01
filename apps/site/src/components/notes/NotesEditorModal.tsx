import { Modal } from "antd";
import React from "react";
import { useForm } from "react-hook-form";
import NotesEditorForm, {
  NEW_NOTE,
  type NotesFormInput,
} from "./NotesEditorForm";

export interface NotesEditorModalProps {
  open: boolean;
  close: () => void;
}

const NotesEditorModal: React.FunctionComponent<NotesEditorModalProps> = ({
  open,
  close,
}: NotesEditorModalProps) => {
  const { handleSubmit, control, reset } = useForm<NotesFormInput>({
    defaultValues: NEW_NOTE,
    mode: "onChange",
    reValidateMode: "onChange",
  });

  return (
    <Modal
      title="Add note"
      open={open}
      onOk={() => close()}
      onCancel={() => close()}
      width={"80%"}
      footer={null}
      style={{
        top: 100,
      }}
      styles={{
        content: {
          padding: 0,
        },
        header: {
          padding: "20px 20px 5px 20px",
        },
        footer: {
          padding: "5px 20px 20px 20px",
        },
      }}
    >
      <NotesEditorForm
        onClose={close}
        formControl={{
          control: control,
          reset: reset,
          handleSubmit: handleSubmit,
        }}
      />
    </Modal>
  );
};
export default NotesEditorModal;
