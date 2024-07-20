import { DeleteFilled } from "@ant-design/icons";
import {
  AutoComplete,
  Avatar,
  Button,
  Card,
  DatePicker,
  Empty,
  Form,
  Space,
  Typography,
} from "antd";
import dayjs from "dayjs";
import { DateTime } from "luxon";
import React, { useEffect, useState } from "react";
import {
  Controller,
  type SubmitHandler,
  useFieldArray,
  useForm,
} from "react-hook-form";
import themisApi from "../../api/themisApi";
import type { BasicUserInfo } from "../../types/themis";

export interface AddReviewYearPanelProps {
  existingYears: string[];
  close: () => void;
  afterAdd: () => Promise<void>;
}

interface ReviewYearFormData {
  review: {
    year?: string;
    users: BasicUserInfo[];
  };
}

const NEW_REVIEW_YEAR: ReviewYearFormData = {
  review: {
    users: [],
  },
};

const AddReviewYearPanel: React.FunctionComponent<AddReviewYearPanelProps> = ({
  existingYears,
  close,
  afterAdd,
}) => {
  const { handleSubmit, control, reset } = useForm<ReviewYearFormData>({
    defaultValues: NEW_REVIEW_YEAR,
    mode: "onChange",
    reValidateMode: "onChange",
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "review.users",
  });

  const onSubmit: SubmitHandler<ReviewYearFormData> = async (data) => {
    await themisApi.upsertReviewYearBasicInfo(data.review.year!, {
      review: {
        users: data.review.users.map((user) => {
          return user.username;
        }),
      },
    });
    await afterAdd();
    reset(NEW_REVIEW_YEAR);
    close();
  };

  const [userSearchValue, setUserSearchValue] = useState("");
  const [users, setUsers] = useState<Record<string, BasicUserInfo>>({});
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState(false);

  const loadUsers = async () => {
    setUsersLoading(true);
    setUsersError(false);

    try {
      const response = await themisApi.listUsers();
      const newUsers: Record<string, BasicUserInfo> = {};

      response.users.forEach((user: BasicUserInfo) => {
        newUsers[user.username] = user;
      });

      setUsers(newUsers);
      reset(response);
    } catch (e) {
      setUsersError(true);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await loadUsers();
    })();
  }, []);

  const userRows = fields.map((unused, index) => {
    return (
      <Controller
        name={`review.users.${index}`}
        control={control}
        rules={{ required: true }}
        render={({ field }) => {
          return (
            <Space
              direction={"horizontal"}
              size={8}
              style={{
                width: "100%",
                justifyContent: "space-between",
              }}
            >
              <Space
                direction={"horizontal"}
                size={8}
                style={{ width: "100%" }}
              >
                <Avatar
                  size={"large"}
                  shape={"square"}
                  src={`https://cdn.ncfritz.net/amzn/avatar/${field.value.username}.jpg`}
                />
                <Space direction={"vertical"} size={0}>
                  <Typography.Text italic={true} style={{ fontSize: 11 }}>
                    @{field.value.username}
                  </Typography.Text>
                  <Typography.Text style={{ fontSize: 12 }}>
                    {field.value.givenName} {field.value.surname}
                  </Typography.Text>
                </Space>
              </Space>
              <Button
                type={"text"}
                icon={<DeleteFilled />}
                onClick={() => {
                  remove(index);
                }}
              />
            </Space>
          );
        }}
      />
    );
  });

  return (
    <Space direction={"vertical"} style={{ width: "100%" }}>
      <Form layout="vertical">
        <Space direction={"vertical"} size={16} style={{ width: "100%" }}>
          <Controller
            name={"review.year"}
            control={control}
            rules={{ required: true }}
            render={({ field, fieldState }) => (
              <Form.Item
                label="Year"
                validateStatus={fieldState.error ? "error" : undefined}
                help={fieldState.error ? fieldState.error.message : undefined}
              >
                <DatePicker
                  picker={"year"}
                  disabledDate={(d) => {
                    return existingYears.includes(d.get("year").toString());
                  }}
                  value={field.value ? dayjs(field.value) : undefined}
                  onChange={(_, dateString) => {
                    field.onChange(dateString); // No need of a state
                  }}
                  style={{ width: "100%" }}
                />
              </Form.Item>
            )}
          />
          <Form.Item label="Users">
            <AutoComplete
              value={userSearchValue}
              onChange={(value) => {
                setUserSearchValue(value);
              }}
              style={{ width: "100%" }}
              allowClear={true}
              options={Object.entries(users).map(([key, value]) => {
                return { value: key, info: value };
              })}
              optionRender={(option) => {
                return (
                  <Space
                    direction={"horizontal"}
                    size={8}
                    style={{ width: "100%" }}
                  >
                    <Avatar
                      size={"small"}
                      src={`https://cdn.ncfritz.net/amzn/avatar/${option.data.info.username}.jpg`}
                    />
                    <Space
                      direction={"horizontal"}
                      style={{ justifyContent: "space-between", width: "100%" }}
                    >
                      <Typography.Text
                        italic={true}
                        style={{ maxWidth: 250, minWidth: 250 }}
                      >
                        @{option.data.info.username}
                      </Typography.Text>
                      <Typography.Text>
                        {option.data.info.givenName} {option.data.info.surname}
                      </Typography.Text>
                    </Space>
                  </Space>
                );
              }}
              placeholder="Search users"
              filterOption={(inputValue, option) => {
                return (
                  option!.info.username
                    .toUpperCase()
                    .indexOf(inputValue.toUpperCase()) !== -1 ||
                  option!.info.givenName
                    .toUpperCase()
                    .indexOf(inputValue.toUpperCase()) !== -1 ||
                  option!.info.surname
                    .toUpperCase()
                    .indexOf(inputValue.toUpperCase()) !== -1
                );
              }}
              onSelect={(value, option) => {
                append(option.info);
                setUserSearchValue("");
              }}
            />
          </Form.Item>
          <Card
            style={{
              maxHeight: "600px",
              overflowY: "scroll",
            }}
            styles={{
              body: {
                padding: 8,
              },
            }}
          >
            {userRows.length > 0 ? (
              userRows
            ) : (
              <Empty description={"No users selected"} />
            )}
          </Card>
          <Space
            size={8}
            direction={"horizontal"}
            style={{ width: "100%", justifyContent: "end", marginTop: 8 }}
          >
            <Button
              type={"primary"}
              onClick={() => {
                handleSubmit(onSubmit)();
              }}
            >
              Save
            </Button>
            <Button
              type={"primary"}
              danger={true}
              onClick={() => {
                reset(NEW_REVIEW_YEAR);
                close();
              }}
            >
              Cancel
            </Button>
          </Space>
        </Space>
      </Form>
    </Space>
  );
};
export default AddReviewYearPanel;
