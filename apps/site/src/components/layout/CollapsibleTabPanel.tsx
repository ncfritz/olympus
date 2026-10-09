import { Layout, Tabs, type TabsProps } from "antd";
import React, { type CSSProperties, type ReactNode } from "react";
import { useDispatch } from "react-redux";
import { useAppSelector } from "../../redux/hooks";
import { setTabPanelExpanded } from "../../redux/slices/layoutSlice";

const { Content, Sider } = Layout;

export interface CollapsibleTabPanelProps {
  children: ReactNode | ReactNode[];
  tabs: TabsProps["items"];
  width: number;
  style?: CSSProperties;
  tabContentStyle?: CSSProperties;
  panelId?: string;
  /** Open until it is first closed; otherwise closed until first opened. */
  defaultExpanded?: boolean;
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
  defaultExpanded = false,
}: CollapsibleTabPanelProps) => {
  const dispatch = useDispatch();

  const expanded = useAppSelector((state) =>
    panelId
      ? (state.layout.expandedTabPanels[panelId] ?? defaultExpanded)
      : false,
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
          // From what is shown, which may be the default, not yet stored.
          dispatch(setTabPanelExpanded({ key: panelId, expanded: !expanded }));
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
