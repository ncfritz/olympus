import { HomeOutlined } from "@ant-design/icons";
import { Space } from "antd";
import Link from "next/link";
import OlympusBreadcrumbs from "../../components/layout/OlympusBreadcrumbs";
import { CertificationOutlined } from "../../icons";

const IndexPage: React.FunctionComponent = () => {
  return (
    <>
      <OlympusBreadcrumbs
        className={"dark"}
        items={[
          {
            title: (
              <Link href={"/"}>
                <Space size={4}>
                  <HomeOutlined />
                  <span>Home</span>
                </Space>
              </Link>
            ),
          },
          {
            title: (
              <Space>
                <CertificationOutlined />
                <span>Dionysus</span>
              </Space>
            ),
          },
        ]}
      />
    </>
  );
};

export default IndexPage;
