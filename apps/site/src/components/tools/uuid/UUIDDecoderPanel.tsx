import { CheckCircleFilled, CloseCircleFilled } from "@ant-design/icons";
import { Button, Divider, Form, Input, Space, Typography } from "antd";
import { DateTime } from "luxon";
import { useForm, Controller, type SubmitHandler } from "react-hook-form";
import React, { type ReactNode, useEffect, useState } from "react";
import { parse as uuidParse, version as uuidVersion } from "uuid";
import { v1 } from "uuid-time";
import {
  buttonItemLayout,
  CLOCK_HIGH,
  CLOCK_LOW,
  DASH,
  formItemLayout,
  HASH_MD5,
  HASH_SHA1,
  NODE,
  RANDOM,
  TIME_HIGH,
  TIME_LOW,
  TIME_MID,
  VARIANT,
  VERSION,
} from "./constants";
import { getByteString, getDefinitionForVersion, getVariant } from "./utils";
import UUIDDigit from "./UUIDDigit";
import UUIDPartRow from "./UUIDPartRow";

export interface UUIDDecoderPanelProps {
  input?: string;
  setDocsVersion: (version: string[]) => void;
  currentDocsVersion: string[];
}

const DASH_LOCATIONS = [7, 11, 15, 19];

interface FormInput {
  input?: string;
}

const UUIDDecoderPanel: React.FunctionComponent<UUIDDecoderPanelProps> = ({
  input,
  setDocsVersion,
  currentDocsVersion,
}: UUIDDecoderPanelProps) => {
  const [parsed, setParsed] = useState<Uint16Array | undefined>(undefined);
  const [error, setError] = useState(false);
  const [version, setVersion] = useState<number | undefined>(undefined);
  const [selectedDigitType, setSelectedDigitType] = useState<
    string | undefined
  >(undefined);

  const {
    handleSubmit,
    control,
    reset,
    formState: { isValid },
    setValue,
    trigger,
  } = useForm<FormInput>({
    defaultValues: {
      input: input,
    },
    mode: "onChange",
    reValidateMode: "onChange",
  });

  const onSubmit: SubmitHandler<FormInput> = (data) => {
    parse(data.input!);
  };

  useEffect(() => {
    (async () => {
      if (input) {
        setValue("input", input);
        const valid = await trigger();

        if (valid) {
          parse(input);
        }
      }
    })();
  }, [input]);

  const parse = (value: string) => {
    setParsed(undefined);
    setError(false);
    setVersion(undefined);

    try {
      const parsedUuid = uuidParse(value);
      const parsedVersion = uuidVersion(value);

      setVersion(parsedVersion);
      setParsed(new Uint16Array(parsedUuid));

      setDocsVersion([
        parsedVersion === 3 || parsedVersion === 5
          ? "v35"
          : `v${parsedVersion}`,
      ]);

      setError(false);
    } catch (e) {
      setError(true);
    }
  };

  let content = undefined;

  if (parsed) {
    const uuidDisplay: ReactNode[] = [];
    const bytes: number[] = [];
    const definition = getDefinitionForVersion(version!);

    parsed.forEach((value) => {
      bytes.push(value >> 4);
      bytes.push(value & 0x0f);
    });

    bytes.forEach((value, index) => {
      uuidDisplay.push(
        <UUIDDigit
          value={value.toString(16)}
          type={definition[index]}
          index={index}
          selectedType={selectedDigitType}
        />,
      );

      if (DASH_LOCATIONS.indexOf(index) >= 0) {
        uuidDisplay.push(
          <Space direction={"vertical"} size={16}>
            <Space direction={"vertical"} size={4}>
              <div
                style={{
                  minWidth: 16,
                  maxWidth: 16,
                  height: 16,
                  background: "#ffffff",
                }}
              ></div>
              {DASH}
            </Space>
            {DASH}
          </Space>,
        );
      }
    });

    let versionInfoPanel = <></>;

    const variant = getVariant(bytes);

    if (version === 1) {
      const timeLow = getByteString(bytes, 0, 8);
      const timeMid = getByteString(bytes, 8, 12);
      const timeHigh = getByteString(bytes, 13, 16);
      const macAddress = getByteString(parsed, 10, 16, ":");
      const clockHigh = getByteString(bytes, 17, 18);
      const clockLow = getByteString(bytes, 18, 20);

      const timestamp = v1(parsed);

      versionInfoPanel = (
        <Space direction={"vertical"} size={8} style={{ marginTop: 16 }}>
          <UUIDPartRow
            label={"time_low"}
            types={[TIME_LOW]}
            description={
              <Typography.Text style={{ fontFamily: "monospace" }}>
                {timeLow}
              </Typography.Text>
            }
            onHover={setSelectedDigitType}
          />
          <UUIDPartRow
            label={"time_mid"}
            types={[TIME_MID]}
            description={
              <Typography.Text style={{ fontFamily: "monospace" }}>
                {timeMid}
              </Typography.Text>
            }
            onHover={setSelectedDigitType}
          />
          <UUIDPartRow
            label={"time_high"}
            types={[TIME_HIGH]}
            description={
              <Typography.Text style={{ fontFamily: "monospace" }}>
                {timeHigh}
              </Typography.Text>
            }
            onHover={setSelectedDigitType}
          />
          <UUIDPartRow
            label={"timestamp"}
            types={[TIME_LOW, TIME_MID, TIME_HIGH]}
            description={`${timestamp} - ${DateTime.fromMillis(
              timestamp,
            ).toISO()}`}
            onHover={setSelectedDigitType}
          />
          <UUIDPartRow
            label={"version"}
            types={[VERSION]}
            description={version}
            onHover={setSelectedDigitType}
          />
          <UUIDPartRow
            label={"variant"}
            types={[VARIANT]}
            description={variant}
            onHover={setSelectedDigitType}
          />
          <UUIDPartRow
            label={"clock_seq_high"}
            types={[CLOCK_HIGH]}
            description={
              <Typography.Text style={{ fontFamily: "monospace" }}>
                {clockHigh}
              </Typography.Text>
            }
            onHover={setSelectedDigitType}
          />
          <UUIDPartRow
            label={"clock_seq_low"}
            types={[CLOCK_LOW]}
            description={
              <Typography.Text style={{ fontFamily: "monospace" }}>
                {clockLow}
              </Typography.Text>
            }
            onHover={setSelectedDigitType}
          />
          <UUIDPartRow
            label={"node"}
            types={[NODE]}
            description={
              <Typography.Text style={{ fontFamily: "monospace" }}>
                {macAddress}
              </Typography.Text>
            }
            onHover={setSelectedDigitType}
          />
        </Space>
      );
    } else if (version === 3 || version === 5) {
      versionInfoPanel = (
        <Space direction={"vertical"} size={8} style={{ marginTop: 16 }}>
          <UUIDPartRow
            label={version === 3 ? "hash_md5" : "hash_sha1"}
            types={[version === 3 ? HASH_MD5 : HASH_SHA1]}
            description={""}
            onHover={setSelectedDigitType}
          />
          <UUIDPartRow
            label={"version"}
            types={[VERSION]}
            description={version}
            onHover={setSelectedDigitType}
          />
          <UUIDPartRow
            label={"variant"}
            types={[VARIANT]}
            description={variant}
            onHover={setSelectedDigitType}
          />
        </Space>
      );
    } else if (version === 4) {
      versionInfoPanel = (
        <Space direction={"vertical"} size={8} style={{ marginTop: 16 }}>
          <UUIDPartRow
            label={"random"}
            types={[RANDOM]}
            description={""}
            onHover={setSelectedDigitType}
          />
          <UUIDPartRow
            label={"version"}
            types={[VERSION]}
            description={version}
            onHover={setSelectedDigitType}
          />
          <UUIDPartRow
            label={"variant"}
            types={[VARIANT]}
            description={variant}
            onHover={setSelectedDigitType}
          />
        </Space>
      );
    }

    content = (
      <>
        <Divider />
        <Space direction={"vertical"} size={16}>
          {error ? (
            <Space direction={"horizontal"} size={8}>
              <CloseCircleFilled
                style={{ color: "#990000", fontSize: "18px" }}
              />
              <Typography.Text style={{ color: "#990000", margin: 0 }}>
                Invalid UUID
              </Typography.Text>
            </Space>
          ) : (
            <Space direction={"horizontal"} size={8}>
              <CheckCircleFilled
                style={{ color: "#009900", fontSize: "32px" }}
              />
              <Typography.Title
                level={4}
                style={{ color: "#009900", margin: 0 }}
              >
                UUID is valid
              </Typography.Title>
            </Space>
          )}
          <Space direction={"horizontal"} size={4}>
            {uuidDisplay}
          </Space>
          <Divider />
          {versionInfoPanel}
        </Space>
      </>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Space
        direction={"vertical"}
        size={8}
        style={{ width: "100%" }}
        onClick={() => {
          if (version) {
            const targetDocsVersion =
              version === 3 || version === 5 ? "v35" : `v${version}`;

            if (currentDocsVersion.indexOf(targetDocsVersion) === -1) {
              setDocsVersion([targetDocsVersion]);
            }
          }
        }}
      >
        <Space
          direction={"horizontal"}
          style={{ width: "100%", display: "block" }}
        >
          <Controller
            name={"input"}
            control={control}
            rules={{
              required: "UUID must be specified",
              pattern: {
                value:
                  /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/,
                message:
                  "UUID must be in format XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX, where X is 0-9, a-f, or A-F",
              },
            }}
            render={({ field, fieldState }) => (
              <Form.Item
                {...formItemLayout}
                label={"UUID"}
                validateStatus={
                  fieldState.error && field.value && field.value.length > 0
                    ? "error"
                    : undefined
                }
                help={
                  fieldState.error && field.value && field.value.length > 0
                    ? fieldState.error.message
                    : undefined
                }
              >
                <Input
                  style={{ width: 350 }}
                  {...field}
                  placeholder={"00000000-0000-0000-0000-000000000000"}
                  allowClear={true}
                />
              </Form.Item>
            )}
          />
        </Space>
        <Form.Item {...buttonItemLayout} style={{ width: "100%" }}>
          <Space direction={"horizontal"} size={8} style={{ width: "100%" }}>
            <Button
              type={"primary"}
              style={{ width: 150 }}
              htmlType={"submit"}
              disabled={!isValid}
            >
              Parse
            </Button>
            {parsed && (
              <Button
                type={"primary"}
                ghost={true}
                icon={<CloseCircleFilled />}
                onClick={() => {
                  reset({ input: "" });
                  setError(false);
                  setParsed(undefined);
                  setVersion(undefined);
                }}
              >
                Clear
              </Button>
            )}
          </Space>
        </Form.Item>
        {content}
      </Space>
    </form>
  );
};
export default UUIDDecoderPanel;
