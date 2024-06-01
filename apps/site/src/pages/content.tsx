import { QRCode } from "antd";

const IndexPage: React.FunctionComponent = () => {
  return (
    <QRCode
      value={
        "otpauth://totp/SecretKey?secret=KJZXG6KPKQ3HEVCGKJTFWRJKIBXUSWCTMFKWSKC5LJYDIZZMEVIQ"
      }
    />
  );
};

export default IndexPage;
