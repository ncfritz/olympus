import { LockFilled } from "@ant-design/icons";
import { Col, Result, Row, Space, Spin } from "antd";
import { useEffect, useState } from "react";
import OtpInput from "react-otp-input";
import contentApi from "../../api/contentApi";
import { useAppSelector } from "../../redux/hooks";

export interface ContentAuthWrapperProps {
  children: React.ReactNode;
}

const ContentAuthWrapper: React.FunctionComponent<ContentAuthWrapperProps> = ({
  children,
}: ContentAuthWrapperProps) => {
  const blackCurtainEnabled = useAppSelector(
    (state) => state.blackCurtain.active,
  );

  const [authorized, setAuthorized] = useState(true);
  const [otp, setOtp] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<any>(undefined);

  const handleOnChange = async (value: string) => {
    setOtp(value);

    if (value.length >= 6) {
      await verifyOtp(value);
    }
  };

  const fetchAuthStatus = async () => {
    try {
      const checauthResponse = await contentApi.checkAuthStatus();
      setAuthorized(checauthResponse.data.authorized);
    } catch (e) {
      setAuthorized(false);
    } finally {
    }
  };

  const verifyOtp = async (value: string) => {
    setSubmitting(true);

    try {
      const verifyOtpResponse = await contentApi.verifyAuthCode(value);
      setAuthorized(verifyOtpResponse.data.authorized);
      setAuthError(false);
    } catch (e) {
      setAuthorized(false);
      setAuthError(e);
    } finally {
      setSubmitting(false);
      setOtp("");
    }
  };

  useEffect(() => {
    (async () => {
      await fetchAuthStatus();
    })();
  }, [blackCurtainEnabled]);

  if (!blackCurtainEnabled && !authorized) {
    const otpInput = (
      <OtpInput
        numInputs={6}
        value={otp}
        onChange={handleOnChange}
        renderInput={(props) => <input {...props} />}
        inputStyle={{
          fontSize: 48,
          width: 64,
          height: 64,
          textAlign: "center",
          margin: 16,
          borderRadius: 5,
        }}
        shouldAutoFocus={true}
      />
    );

    return (
      <Row>
        <Col
          span={24}
          style={{
            marginTop: "10vh",
            justifyContent: "center",
            display: "flex",
          }}
        >
          <Space size={8} direction={"vertical"}>
            {authError ? (
              <Result
                status="error"
                title={"Authorization Failed"}
                subTitle={"You didn't say the magic word..."}
              />
            ) : (
              <Result
                status="info"
                icon={<LockFilled />}
                title={"Authentication Required"}
                subTitle={"Please supply a valid OTP"}
              />
            )}
            {submitting ? <Spin spinning={true}>{otpInput}</Spin> : otpInput}
          </Space>
        </Col>
      </Row>
    );
  } else {
    return <>{children}</>;
  }
};
export default ContentAuthWrapper;
