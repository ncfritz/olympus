import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import { Button } from "antd";
import React, { useContext } from "react";

import { VisibilityContext } from "react-horizontal-scrolling-menu";

function Arrow({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled: boolean;
  onClick: VoidFunction;
}) {
  return (
    <Button
      type={"text"}
      size={"small"}
      disabled={disabled}
      onClick={onClick}
      style={{
        cursor: "pointer",
        display: disabled ? "none" : "flex",
        flexDirection: "column",
        justifyContent: "center",
        right: "1%",
        opacity: disabled ? "0" : "1",
        userSelect: "none",
        height: "100%",
      }}
    >
      {children}
    </Button>
  );
}

export const LeftArrow: React.FunctionComponent = () => {
  const visibility = useContext(VisibilityContext);
  const isFirstItemVisible = visibility.useIsVisible("first", true);

  return (
    <Arrow disabled={isFirstItemVisible} onClick={visibility.scrollPrev}>
      <LeftOutlined />
    </Arrow>
  );
};

export const RightArrow: React.FunctionComponent = () => {
  const visibility = useContext(VisibilityContext);
  const isLastItemVisible = visibility.useIsVisible("last", false);

  return (
    <Arrow disabled={isLastItemVisible} onClick={visibility.scrollNext}>
      <RightOutlined />
    </Arrow>
  );
};
