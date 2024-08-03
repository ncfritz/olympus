import {
  Button,
  Col,
  Flex,
  Form,
  Input,
  Row,
  Select,
  Space,
  Typography,
} from "antd";
import React from "react";
import {
  type Control,
  Controller, type FieldArrayWithId,
  type UseFieldArrayRemove,
  type UseFormRegister,
} from "react-hook-form";
import type {Mentee} from "../../../types/themis";
import NoteSummaryRichTextEditor from "../../notes/NoteSummaryRitchTextEditor";
import Badge from "../Badge";
import type { MentorshipFormData } from "../data/MentorshipPanel";

export interface MentorshipEntryRowProps {
  index: number;
  control: Control<MentorshipFormData>;
  register: UseFormRegister<MentorshipFormData>;
  remove: UseFieldArrayRemove;
  mentees: Mentee[];
}

const MentorshipEntryRow: React.FunctionComponent<MentorshipEntryRowProps> = ({
  index,
  control,
  register,
  remove,
  mentees,
}) => {
  return (
    <Flex
      vertical={false}
      style={{
        width: "100%",
        gap: 8,
        borderBottom: "1px solid #e6e6e6",
        marginTop: 8,
        paddingBottom: 16,
      }}
    >
      <Flex vertical={true} style={{ gap: 4 }}>
        <Badge
          username={mentees[index].alias}
          name={mentees[index].givenName}
          tenure={1}
          size={"small"}
        />
        <Button
          type={"primary"}
          danger={true}
          size={"small"}
          style={{ width: "100%" }}
          onClick={() => {
            remove(index);
          }}
        >
          Remove
        </Button>
      </Flex>
      <Space direction={"vertical"} style={{ width: "100%" }}>
        <Row gutter={8}>
          <Col span={3}>
            <Typography.Text
              strong={true}
              style={{ display: "flex", justifyContent: "end" }}
            >
              Alias:
            </Typography.Text>
          </Col>
          <Col span={5}>
            <Controller
              name={`mentorship.${index}.alias`}
              control={control}
              rules={{ required: true, min: 0 }}
              render={({ field, fieldState }) => (
                <Input
                  {...register(`mentorship.${index}.alias`)}
                  {...field}
                  placeholder="alias"
                  data-1p-ignore={true}
                />
              )}
            />
          </Col>
          <Col span={3}>
            <Typography.Text
              strong={true}
              style={{ display: "flex", justifyContent: "end" }}
            >
              First Name:
            </Typography.Text>
          </Col>
          <Col span={5}>
            <Controller
              name={`mentorship.${index}.givenName`}
              control={control}
              rules={{ required: true, min: 0 }}
              render={({ field, fieldState }) => (
                <Input
                  {...register(`mentorship.${index}.givenName`)}
                  {...field}
                  placeholder="Firat name"
                  data-1p-ignore={true}
                />
              )}
            />
          </Col>
          <Col span={3}>
            <Typography.Text
              strong={true}
              style={{ display: "flex", justifyContent: "end" }}
            >
              Last Name:
            </Typography.Text>
          </Col>
          <Col span={5}>
            <Controller
              name={`mentorship.${index}.surname`}
              control={control}
              rules={{ required: true, min: 0 }}
              render={({ field, fieldState }) => (
                <Input
                  {...register(`mentorship.${index}.surname`)}
                  {...field}
                  placeholder="Last name"
                  data-1p-ignore={true}
                />
              )}
            />
          </Col>
        </Row>
        <Row gutter={8}>
          <Col span={3}>
            <Typography.Text
              strong={true}
              style={{ display: "flex", justifyContent: "end" }}
            >
              Level:
            </Typography.Text>
          </Col>
          <Col span={5}>
            <Controller
              name={`mentorship.${index}.level`}
              control={control}
              rules={{ required: true }}
              render={({ field, fieldState }) => (
                <Select
                  {...register(`mentorship.${index}.level`)}
                  {...field}
                  value={field.value}
                  style={{ width: "100%" }}
                  options={[
                    { value: -1, label: "Unknown" },
                    { value: 3, label: "L3" },
                    { value: 4, label: "L4" },
                    { value: 5, label: "L5" },
                    { value: 6, label: "L6" },
                    { value: 7, label: "L7" },
                    { value: 8, label: "L8" },
                  ]}
                />
              )}
            />
          </Col>
          <Col span={3}>
            <Typography.Text
              strong={true}
              style={{ display: "flex", justifyContent: "end" }}
            >
              Department:
            </Typography.Text>
          </Col>
          <Col span={5}>
            <Controller
              name={`mentorship.${index}.department`}
              control={control}
              rules={{ required: true, min: 0 }}
              render={({ field, fieldState }) => (
                <Input
                  {...register(`mentorship.${index}.department`)}
                  {...field}
                  placeholder="Department"
                  data-1p-ignore={true}
                />
              )}
            />
          </Col>
          <Col span={3}>
            <Typography.Text
              strong={true}
              style={{ display: "flex", justifyContent: "end" }}
            >
              Relationship:
            </Typography.Text>
          </Col>
          <Col span={5}>
            <Controller
              name={`mentorship.${index}.type`}
              control={control}
              rules={{ required: true, min: 0 }}
              render={({ field, fieldState }) => (
                <Select
                  {...register(`mentorship.${index}.type`)}
                  {...field}
                  value={field.value}
                  style={{ width: "100%" }}
                  options={[
                    { value: "Peer", label: "Peer / Teammate" },
                    { value: "External", label: "External to Team" },
                  ]}
                />
              )}
            />
          </Col>
        </Row>
        <Row gutter={8}>
          <Col span={3}>
            <Typography.Text
              strong={true}
              style={{ display: "flex", justifyContent: "end" }}
            >
              Notes:
            </Typography.Text>
          </Col>
          <Col span={21}>
            <Controller
              name={`mentorship.${index}.notes`}
              control={control}
              render={({ field: { onChange, value } }) => (
                <NoteSummaryRichTextEditor
                  onChange={onChange}
                  value={value}
                  height={250}
                />
              )}
            />
          </Col>
        </Row>
      </Space>
    </Flex>
  );
};
export default MentorshipEntryRow;
