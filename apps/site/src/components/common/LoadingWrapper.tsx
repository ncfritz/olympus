import { Space } from "antd";
import type { CSSProperties, ReactNode } from "react";
import ErrorBlock from "./ErrorBlock";
import Loader from "./Loader";

export interface LoadingWrapperProps {
  loading: boolean;
  loader?: ReactNode;
  showError?: boolean;
  showErrorDetails?: boolean;
  error?: Error;
  style?: CSSProperties;
  children: ReactNode | ReactNode[];
}

const LoadingWrapper: React.FunctionComponent<LoadingWrapperProps> = ({
  loading,
  loader,
  showError = true,
  showErrorDetails = false,
  error,
  children,
  style,
}: LoadingWrapperProps) => {
  let content: ReactNode | ReactNode[] = undefined;

  if (loading) {
    content = loader || <Loader />;
  } else if (error) {
    if (showError) {
      content = <ErrorBlock error={error} includeStack={showErrorDetails} />;
    }
  } else {
    content = children;
  }

  return (
    <Space
      style={{ width: "100%", ...style }}
      styles={{ item: { height: "inherit" } }}
      orientation={"vertical"}
    >
      {content}
    </Space>
  );
};
export default LoadingWrapper;
