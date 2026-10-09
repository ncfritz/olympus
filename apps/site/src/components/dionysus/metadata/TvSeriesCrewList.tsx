import {
  CaretRightOutlined,
  FilterFilled,
  InfoCircleOutlined,
  ProfileOutlined,
  TableOutlined,
} from "@ant-design/icons";
import type {
  BasePerson,
  TvSeriesCrewMember,
  TvSeriesCrewMemberJob,
} from "@ncfritz/olympus-sdk/dionysus";
import {
  Collapse,
  type CollapseProps,
  Empty,
  Input,
  List,
  Popover,
  Radio,
  Space,
  Typography,
} from "antd";
import { useEffect, useState } from "react";
import { useDebounce } from "use-debounce";
import PersonCard from "./PersonCard";

export interface TvSeriesCrewListProps {
  crew: TvSeriesCrewMember[];
  filterable?: boolean;
  defaultLayout?: "grid" | "list";
}

const TvSeriesCrewList: React.FunctionComponent<TvSeriesCrewListProps> = ({
  crew,
  filterable = true,
  defaultLayout = "grid",
}: TvSeriesCrewListProps) => {
  const [layout, setLayout] = useState<"list" | "grid">(defaultLayout);
  const [filter, setFilter] = useState<string>("");
  const [filteredCrew, setFilteredCrew] = useState(crew);

  const [departments, setDepartments] = useState<Set<string>>(new Set());
  const [departmentPeople, setDepartmentPeople] = useState<
    Map<string, Set<number>>
  >(new Map());
  const [people, setPeople] = useState<Map<number, BasePerson>>(new Map());
  const [personJobs, setPersonJobs] = useState<
    Map<number, Map<string, TvSeriesCrewMemberJob[]>>
  >(new Map());

  const [debouncedFilter] = useDebounce<string>(filter, 300);

  useEffect(() => {
    if (debouncedFilter && debouncedFilter.length >= 3) {
      const newFilteredCast = crew.filter((item) => {
        return item.person.name
          .toLowerCase()
          .includes(debouncedFilter.toLowerCase());
      });

      setFilteredCrew(newFilteredCast);
    } else if (debouncedFilter.length <= 0) {
      setFilteredCrew(crew);
    }
  }, [debouncedFilter]);

  useEffect(() => {
    const newDepartments: Set<string> = new Set();
    const newDepartmentPeople: Map<string, Set<number>> = new Map();
    const newPeople: Map<number, BasePerson> = new Map();
    const newPersonJobs: Map<
      number,
      Map<string, TvSeriesCrewMemberJob[]>
    > = new Map();

    if (filteredCrew && filteredCrew.length > 0) {
      filteredCrew.forEach((item) => {
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
          personJobSet.set(item.department, []);
        }

        personJobSet.get(item.department)!.push(...item.jobs);
      });

      setDepartments(newDepartments);
      setDepartmentPeople(newDepartmentPeople);
      setPeople(newPeople);
      setPersonJobs(newPersonJobs);
    }
  }, [filteredCrew]);

  const columns = layout === "grid" ? 12 : 1;

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
        label: (
          <Typography.Text
            style={{
              fontSize: "16px",
              color: "#333333",
              fontWeight: 500,
            }}
          >
            {department}
          </Typography.Text>
        ),
        styles: {
          header: { marginBottom: 8 },
        },
        children: (
          <List
            grid={{ column: columns, gutter: 16 }}
            dataSource={departmentMembers}
            renderItem={(item) => {
              const itemJobs = personJobs.get(item.id)!.get(department);
              const jobsInfo = itemJobs!.map((job) => {
                return (
                  <Space orientation={"horizontal"}>
                    <Typography.Text style={{ fontSize: "11px" }}>
                      {job.job}
                    </Typography.Text>
                    <Typography.Text
                      style={{ fontSize: "10px", color: "#666666" }}
                    >
                      ({job.episodeCount}{" "}
                      {job.episodeCount > 1 ? "episodes" : "episode"})
                    </Typography.Text>
                  </Space>
                );
              });
              return (
                <List.Item>
                  {layout === "grid" ? (
                    <PersonCard direction={"vertical"} person={item}>
                      <Typography.Text
                        style={{
                          fontSize: "10px",
                          lineHeight: 1,
                        }}
                      >
                        <Popover
                          content={
                            <Space size={0} direction={"vertical"}>
                              {jobsInfo}
                            </Space>
                          }
                        >
                          <Space
                            direction={"horizontal"}
                            size={4}
                            style={{ alignItems: "start" }}
                          >
                            <InfoCircleOutlined />
                            <Space orientation={"vertical"} size={2}>
                              {`${itemJobs!.length} ${itemJobs!.length > 1 ? "jobs" : "job"}`}
                            </Space>
                          </Space>
                        </Popover>
                      </Typography.Text>
                    </PersonCard>
                  ) : (
                    <PersonCard direction={"horizontal"} person={item}>
                      {jobsInfo}
                    </PersonCard>
                  )}
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
        expandIcon={({ isActive }) => (
          <CaretRightOutlined rotate={isActive ? 90 : 0} />
        )}
        ghost={true}
        items={collapseItems}
        defaultActiveKey={[...departments]}
      />
    );
  }

  return (
    <Space orientation={"vertical"} size={8} style={{ width: "100%" }}>
      {filterable && (
        <Space
          direction={"horizontal"}
          style={{
            padding: 8,
            background: "#fafafa",
            width: "100%",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Input
            size={"small"}
            prefix={
              <FilterFilled
                style={{
                  color: debouncedFilter?.length >= 3 ? "#1677ff" : "#afafaf",
                }}
              />
            }
            placeholder={"Search by name"}
            allowClear={true}
            style={{
              width: 500,
              background: "#ffffff",
              borderColor: "#efefef",
            }}
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value.trim());
            }}
          />
          <Radio.Group
            size={"small"}
            optionType={"button"}
            defaultValue={layout}
            className={"dionysus-filter-header"}
            onChange={(e) => {
              setLayout(e.target.value);
            }}
            options={[
              {
                value: "list",
                label: <ProfileOutlined />,
              },
              {
                value: "grid",
                label: <TableOutlined />,
              },
            ]}
          />
        </Space>
      )}
      <Space
        direction={"vertical"}
        size={8}
        style={{ padding: 16, paddingTop: 0, width: "100%" }}
      >
        {content}
      </Space>
    </Space>
  );
};
export default TvSeriesCrewList;
