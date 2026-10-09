import { FileImageOutlined } from "@ant-design/icons";
import type {
  BasePerson,
  TvEpisodeCrewMember,
} from "@ncfritz/olympus-sdk/dionysus";
import {
  Card,
  Collapse,
  type CollapseProps,
  Empty,
  List,
  Space,
  Typography,
} from "antd";
import Link from "next/link";
import { useEffect, useState } from "react";

export interface TvEpisodeCrewListProps {
  crew: TvEpisodeCrewMember[];
}

const TvEpisodeCrewList: React.FunctionComponent<TvEpisodeCrewListProps> = ({
  crew,
}: TvEpisodeCrewListProps) => {
  const [departments, setDepartments] = useState<Set<string>>(new Set());
  const [departmentPeople, setDepartmentPeople] = useState<
    Map<string, Set<number>>
  >(new Map());
  const [people, setPeople] = useState<Map<number, BasePerson>>(new Map());
  const [personJobs, setPersonJobs] = useState<
    Map<number, Map<string, Set<string>>>
  >(new Map());

  useEffect(() => {
    const newDepartments: Set<string> = new Set();
    const newDepartmentPeople: Map<string, Set<number>> = new Map();
    const newPeople: Map<number, BasePerson> = new Map();
    const newPersonJobs: Map<number, Map<string, Set<string>>> = new Map();

    if (crew && crew.length > 0) {
      crew.forEach((item) => {
        if (!newDepartments.has(item.department)) {
          newDepartments.add(item.department);
          newDepartmentPeople.set(item.department, new Set());
        }

        newDepartmentPeople.get(item.department)!.add(item.person.id);

        if (!newPeople.has(item.person.id)) {
          newPeople.set(item.person.id, item.person);
        }

        if (!newPersonJobs.has(item.person.id)) {
          newPersonJobs.set(item.person.id, new Map());
        }

        const personJobSet = newPersonJobs.get(item.person.id)!;

        if (!personJobSet.has(item.department)) {
          personJobSet.set(item.department, new Set());
        }

        personJobSet.get(item.department)!.add(item.job);
      });

      setDepartments(newDepartments);
      setDepartmentPeople(newDepartmentPeople);
      setPeople(newPeople);
      setPersonJobs(newPersonJobs);
    }
  }, crew);

  let content = <Empty />;

  if (departments.size > 0) {
    const collapseItems: CollapseProps["items"] = [];

    departments.forEach((department) => {
      const departmentMembers: BasePerson[] = [];

      departmentPeople.get(department)!.forEach((personId) => {
        departmentMembers.push(people.get(personId)!);
      });

      collapseItems.push({
        key: department,
        label: department,
        children: (
          <List
            grid={{ column: 12, gutter: 16 }}
            dataSource={departmentMembers}
            renderItem={(item) => {
              const itemJobs = personJobs.get(item.id)!.get(department);

              return (
                <List.Item>
                  <Link href={`/dionysus/person/${item.id}`}>
                    <Card
                      hoverable={false}
                      styles={{
                        body: {
                          margin: 0,
                          padding: 0,
                          flexDirection: "column",
                          justifyContent: "start",
                          display: "flex",
                        },
                        actions: { margin: 0, padding: 0 },
                      }}
                      cover={
                        item.profilePath ? (
                          <img
                            src={`https://image.tmdb.org/t/p/h632/${item.profilePath}}`}
                            alt={"Poster"}
                          />
                        ) : (
                          <Space
                            style={{
                              aspectRatio: "calc(2 / 3)",
                              backgroundColor: "#eeeeee",
                            }}
                            styles={{
                              item: {
                                display: "flex",
                                alignContent: "center",
                                justifyContent: "center",
                                height: "100%",
                              },
                            }}
                          >
                            <FileImageOutlined
                              style={{ fontSize: "64px", color: "#dddddd" }}
                            />
                          </Space>
                        )
                      }
                    >
                      <Space
                        size={3}
                        direction={"vertical"}
                        style={{ padding: 8, width: "100%" }}
                        styles={{ item: { width: "100%", lineHeight: 1 } }}
                      >
                        <Typography.Text
                          style={{
                            fontSize: "10px",
                            lineHeight: 1,
                          }}
                        >
                          {item.name}
                        </Typography.Text>
                        <Typography.Text
                          style={{
                            fontSize: "9px",
                            color: "#666666",
                            lineHeight: 1,
                          }}
                        >
                          {[...itemJobs!].join(" / ")}
                        </Typography.Text>
                      </Space>
                    </Card>
                  </Link>
                </List.Item>
              );
            }}
          />
        ),
      });
    });

    content = (
      <Collapse
        collapsible={"header"}
        ghost={true}
        items={collapseItems}
        defaultActiveKey={[...departments]}
      />
    );
  }

  return (
    <Space size={8} direction={"vertical"} style={{ width: "100%" }}>
      {content}
    </Space>
  );
};
export default TvEpisodeCrewList;
