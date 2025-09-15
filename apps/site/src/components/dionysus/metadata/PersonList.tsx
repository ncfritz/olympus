import type { BasePerson } from "@ncfritz/olympus-sdk/dionysus";
import { Badge, List, Space, Typography } from "antd";
import Link from "next/link";
import PersonCard from "./PersonCard";

export interface PersonListProps {
  people: BasePerson[];
  loading: boolean;
  columns?: number;
}

const PersonList: React.FunctionComponent<PersonListProps> = ({
  people,
  loading,
  columns = 12,
}: PersonListProps) => {
  return (
    <List
      grid={{ gutter: 16, column: columns }}
      dataSource={people}
      loading={loading}
      renderItem={(item) => {
        return (
          <List.Item>
            <Link href={`/dionysus/person/${item.id}`}>
              <PersonCard person={item} direction={"vertical"}>
                <Space direction={"horizontal"} size={8}>
                  <Typography.Text strong={true} style={{ fontSize: "10px" }}>
                    Score:
                  </Typography.Text>
                  <Typography.Text style={{ fontSize: "10px" }}>
                    {item.popularity}
                  </Typography.Text>
                </Space>
              </PersonCard>
            </Link>
          </List.Item>
        );
      }}
    />
  );
};
export default PersonList;
