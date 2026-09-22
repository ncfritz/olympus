"use client";

import {
  consoleHref,
  consoleKey,
  type Registry,
} from "@ncfritz/olympus-console";
import { Card, Empty, Flex, List, Typography } from "antd";

const { Text } = Typography;

export interface ConsoleIndexProps {
  nav: Registry;
  origin?: string;
}

/**
 * The suite, a card per property. The sider has the same consoles in the
 * same order — this is the way in for someone who arrived at the control
 * host without a console in mind, and where a console's one line of
 * description is worth the room.
 */
export function ConsoleIndex({ nav, origin }: ConsoleIndexProps) {
  if (nav.length === 0) {
    return (
      <Flex align="center" justify="center" flex={1}>
        <Empty description="This host runs no consoles (CONTROL_CONSOLES)." />
      </Flex>
    );
  }

  return (
    <Flex vertical gap="large" style={{ padding: 24 }}>
      {nav.map((property) => (
        <Card key={property.key} title={property.label}>
          <List
            itemLayout="horizontal"
            dataSource={property.consoles}
            renderItem={(entry) => {
              const key = consoleKey(property.key, entry.key);
              return (
                <List.Item>
                  <List.Item.Meta
                    title={
                      /* A document load: each console is its own app. */
                      <a href={consoleHref(key, origin)}>{entry.label}</a>
                    }
                    description={entry.description}
                  />
                  <Text type="secondary" code>
                    {key}
                  </Text>
                </List.Item>
              );
            }}
          />
        </Card>
      ))}
    </Flex>
  );
}
