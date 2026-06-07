import { FilterFilled } from "@ant-design/icons";
import type {
  BasePerson,
  FilterDefinition,
} from "@ncfritz/olympus-sdk/dionysus";
import { Input, List, Space, Typography } from "antd";
import { DateTime } from "luxon";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { useDebounce } from "use-debounce";
import type { SortOptions } from "../../../api/common";
import metadataApi from "../../../api/metadataApi";
import { useFetch } from "../../../hooks/useFetch";
import AgeRangeFilter from "./filter/AgeRangefilter";
import CheckboxFilter from "./filter/CheckboxFilter";
import LoadingWrapper from "../../common/LoadingWrapper";
import Sorter from "./filter/Sorter";
import PersonCard from "./PersonCard";

export interface PersonListProps {
  title?: string;
  initialFilters?: FilterDefinition;
  initialSort?: SortOptions;
  listType: string;
  columns?: number;
  rows?: number;
}

const PersonList: React.FunctionComponent<PersonListProps> = ({
  title,
  initialFilters,
  initialSort = {
    field: "popularity",
    order: "desc",
  },
  listType,
  rows = 1,
  columns = 12,
}: PersonListProps) => {
  const [sort, setSort] = useState(initialSort);
  const [filters, setFilters] = useState(initialFilters);
  const [nameFilter, setNameFilter] = useState<string>("");
  const [genderFilter, setGenderFilter] = useState<number[]>([]);
  const [vitalStatusFilter, setVitalStatusFilter] = useState<("d" | "a")[]>([]);
  const [ageRangeFilter, setAgeRangeFilter] = useState<number[]>([]);

  const [debouncedNameFilter] = useDebounce<string>(nameFilter, 300);

  useEffect(() => {
    const newFilters: FilterDefinition[] = initialFilters
      ? [initialFilters]
      : [];

    if (debouncedNameFilter.length >= 3) {
      newFilters.push({
        type: "ilike",
        name: "name",
        value: `%${debouncedNameFilter}%`,
      });
    }

    if (genderFilter.length > 0) {
      newFilters.push({
        type: "in",
        name: "gender",
        value: genderFilter,
      });
    }

    if (vitalStatusFilter.length > 0) {
      const allSelected = ["a", "d"].every((value: "a" | "d") =>
        vitalStatusFilter.includes(value),
      );

      if (!allSelected) {
        newFilters.push({
          type: "is_null",
          name: "deathday",
          // If the first element is "a" - alive, we want to make sure that the deathday is null
          // otherwise, it must be set for a deceased person
          value: vitalStatusFilter[0] === "a",
        });
      }
    }

    if (ageRangeFilter.length === 2) {
      const now = DateTime.now().startOf("day");

      newFilters.push({
        type: "and",
        name: "__ageRange_and",
        value: [
          {
            type: "lte",
            name: "birthday",
            value: now.minus({ year: ageRangeFilter[0] }).toISODate(),
          },
          {
            type: "gte",
            name: "birthday",
            value: now.minus({ year: ageRangeFilter[1] }).toISODate(),
          },
        ],
      });
    }

    if (newFilters.length > 1) {
      setFilters({ type: "and", name: "__base", value: newFilters });
    } else {
      setFilters(newFilters[0]);
    }
  }, [debouncedNameFilter, genderFilter, vitalStatusFilter, ageRangeFilter]);

  const [people, peopleLoading, peopleError] = useFetch<
    undefined,
    BasePerson[]
  >({
    dataType: listType,
    watch: [sort, filters],
    params: undefined,
    fetchFunction: async () =>
      (await metadataApi.listPeople(0, columns * rows, sort, filters)).data
        .people,
  });

  return (
    <LoadingWrapper loading={peopleLoading} error={peopleError}>
      {title && (
        <Typography.Title level={4} style={{ marginBottom: 0, marginLeft: 16 }}>
          {title}
        </Typography.Title>
      )}
      <Space
        direction={"horizontal"}
        size={8}
        style={{
          backgroundColor: "#efefef",
          width: "100%",
          padding: 8,
          justifyContent: "space-between",
        }}
      >
        <Space orientation={"horizontal"} size={8}>
          <Input
            size={"small"}
            prefix={
              <FilterFilled
                style={{
                  color:
                    debouncedNameFilter?.length >= 3 ? "#1677ff" : "#afafaf",
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
            value={nameFilter}
            onChange={(e) => {
              setNameFilter(e.target.value.trim());
            }}
          />
          <CheckboxFilter
            label={"Gender"}
            items={[
              { key: 0, label: "Unspecified" },
              { key: 1, label: "Female" },
              { key: 2, label: "Male" },
              { key: 3, label: "Non-Binary" },
            ]}
            onFiltersSet={(values) => {
              setGenderFilter(values as number[]);
            }}
          />
          <CheckboxFilter
            label={"Vital Status"}
            items={[
              { key: "a", label: "Alive" },
              { key: "d", label: "Deceased" },
            ]}
            onFiltersSet={(values) => {
              setVitalStatusFilter(values as ("a" | "d")[]);
            }}
          />
          <AgeRangeFilter label={"Age"} onFiltersSet={setAgeRangeFilter} />
        </Space>
        <Space orientation={"horizontal"} size={8}>
          <Sorter
            initialSort={sort.field}
            initialDirection={sort.order}
            sortOptions={{
              popularity: "Popularity",
              name: "Name",
              birthday: "Birthday",
              deathday: "Deathday",
              gender: "Gender",
            }}
            onSortChange={(sort, direction) => {
              setSort({
                field: sort,
                order: direction,
              });
            }}
          />
        </Space>
      </Space>
      <List
        grid={{ gutter: 16, column: columns }}
        style={{ margin: 16, marginTop: 8, marginBottom: 0 }}
        dataSource={people}
        renderItem={(item) => {
          return (
            <List.Item>
              <Link href={`/dionysus/person/${item.id}`}>
                <PersonCard person={item} direction={"vertical"}>
                  <Space orientation={"horizontal"} size={8}>
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
    </LoadingWrapper>
  );
};
export default PersonList;
