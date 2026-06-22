import { Layout, Tabs } from "antd";
import React, { type CSSProperties, type ReactNode } from "react";
import { useDispatch } from "react-redux";
import { useAppSelector } from "../../redux/hooks";
import {
  setTabPanelExpanded,
  toggleTabPanelExpanded,
} from "../../redux/slices/layoutSlice";

const { Content, Sider } = Layout;

export interface CollapsibleTabPanelProps {
  children: ReactNode | ReactNode[];
  tabs: any[];
  width: number;
  style?: CSSProperties;
  tabContentStyle?: CSSProperties;
  panelId?: string;
}

const CollapsibleTabPanel: React.FunctionComponent<
  CollapsibleTabPanelProps
> = ({
  children,
  tabs,
  width,
  style,
  tabContentStyle,
  panelId,
}: CollapsibleTabPanelProps) => {
  const dispatch = useDispatch();

  const expanded = useAppSelector((state) =>
    panelId ? state.layout.expandedTabPanels[panelId] : false
  );

  return (
    <Layout
      style={{
        width: "100%",
        ...style,
      }}
      className={`collapsible-tabs ${expanded ? "expanded" : "collapsed"}`}
    >
      <Content style={{ background: "#ffffff" }}>{children}</Content>
      <Sider
        theme={"light"}
        collapsible={true}
        collapsed={!expanded}
        collapsedWidth={62}
        reverseArrow={true}
        width={expanded ? width : 62}
        onCollapse={() => {
          dispatch(toggleTabPanelExpanded(panelId));
        }}
        style={{
          borderLeft: "1px solid #f6f6f6",
        }}
      >
        <Tabs
          className={`collapsible-tab-panel compact ${
            expanded ? "expanded" : "collapsed"
          }`}
          tabPlacement={"end"}
          items={tabs}
          onChange={() => {
            dispatch(setTabPanelExpanded({ key: panelId, expanded: true }));
          }}
          styles={{
            content: tabContentStyle,
          }}
        />
      </Sider>
    </Layout>
  );
};
export default CollapsibleTabPanel;
