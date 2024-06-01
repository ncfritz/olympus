import { UpOutlined } from "@ant-design/icons";
import { FloatButton, Layout } from "antd";
import styled from "styled-components";
import NoAuthHeader from "./NoAuthHeader";

const { Content } = Layout;

const BackToTopButton = styled.div`
  position: fixed;
  right: 48px;
  background: #888;
  padding: 12px;
  color: #fff;
  border-radius: 45px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #fff;

  &:hover {
    background: #efefef;
    color: #1890ff;
    border: 2px solid #1890ff;
  }
`;

export interface NoAuthLayoutProps {
  children: React.ReactNode;
}

const NoAuthLayout: React.FunctionComponent<NoAuthLayoutProps> = ({
  children,
}) => {
  return (
    <Layout>
      <NoAuthHeader />
      <Layout style={{ position: "relative", top: 64 }}>
        <Content style={{ background: "#fff" }}>
          <div className={"main"}>{children}</div>
          <FloatButton.BackTop visibilityHeight={600}>
            <BackToTopButton>
              <UpOutlined />
            </BackToTopButton>
          </FloatButton.BackTop>
        </Content>
      </Layout>
    </Layout>
  );
};
export default NoAuthLayout;
