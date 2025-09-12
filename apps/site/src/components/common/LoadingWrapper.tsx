import { Alert, Space } from "antd";
import type { CSSProperties, ReactNode } from "react";
import Loader from "./Loader";

export interface LoadingWrapperProps {
  loading: boolean;
  loader?: ReactNode;
  showError?: boolean;
  error?: Error;
  style?: CSSProperties;
  children: ReactNode | ReactNode[];
}

const LoadingWrapper: React.FunctionComponent<LoadingWrapperProps> = ({
  loading,
  loader,
  showError = true,
  error,
  children,
  style,
}: LoadingWrapperProps) => {
  let content: ReactNode | ReactNode[] = undefined;

  if (loading) {
    content = loader || <Loader />;
  } else if (error && showError) {
    content = <Alert type={"error"} />;
  } else {
    content = children;
  }

  return (
    <Space style={{ width: "100%", ...style }} direction={"vertical"}>
      {content}
    </Space>
  );
};
export default LoadingWrapper;
