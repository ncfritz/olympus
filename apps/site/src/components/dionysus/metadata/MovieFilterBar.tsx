import { EyeFilled, FilterFilled, HeartFilled } from "@ant-design/icons";
import type {
  FilterDefinition,
  Genre,
  Language,
} from "@ncfritz/olympus-sdk/dionysus";
import { Input, Space, Switch, Tag, Typography } from "antd";
import { DateTime } from "luxon";
import React, { useEffect, useState } from "react";
import ReactCountryFlag from "react-country-flag/src";
import { useDebounce } from "use-debounce";
import type { SortOptions } from "../../../api/common";
import metadataApi from "../../../api/metadataApi";
import { useFetch } from "../../../hooks/useFetch";
import CheckboxFilter from "./filter/CheckboxFilter";
import DateRangeFilter, {
  type DateRangeFilterValue,
} from "./filter/DateRangeFilter";
import DurationFilter from "./filter/DurationFilter";
import Sorter from "./filter/Sorter";
import { getReleaseStatusForMovie } from "./util";

export interface MovieFilterBarProps {
  onFiltersSet: (filters: FilterDefinition) => void;
  onSortSet: (sort: SortOptions) => void;
  initialSort?: SortOptions;
  genreFilterLogic?: "and" | "or";
}

const MovieFilterBar: React.FunctionComponent<MovieFilterBarProps> = ({
  onFiltersSet,
  onSortSet,
  initialSort = { field: "popularity", order: "desc" },
  genreFilterLogic = "and",
}: MovieFilterBarProps) => {
  const now = DateTime.utc();

  const [titleFilter, setTitleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState(["Released"]);
  const [videoFilter, setVideoFilter] = useState<("f" | "v")[]>(["f"]);
  const [releaseDateFilter, setReleaseDateFilter] = useState<
    DateRangeFilterValue | undefined
  >({
    start: { month: now.month, year: now.year - 1 },
    end: { month: now.month, year: now.year },
  });
  const [spokenLanguageFilter, setSpokenLanguageFilter] = useState<string[]>(
    [],
  );
  const [genresFilter, setGenresFilter] = useState<string[]>([]);
  const [runtimeFilter, setRuntimeFilter] = useState<number[]>([]);
  const [originalLanguageFilter, setOriginalLanguageFilter] = useState<
    string[]
  >([]);
  const [missingFilter, setMissingFilter] = useState<string[]>([]);
  const [monitoredFilter, setMonitoredFilter] = useState(false);
  const [favoriteFilter, setFavoriteFilter] = useState(false);

  const [debouncedTitleFilter] = useDebounce<string>(titleFilter, 300);

  const [languages, languagesLoading, languagesError] = useFetch<
    undefined,
    Language[]
  >({
    dataType: "languages",
    watch: [],
    params: undefined,
    fetchFunction: async () =>
      (
        await metadataApi.listLanguages(
          0,
          { field: "name", order: "desc" },
          500,
        )
      ).data.languages,
  });

  const [genres, genresLoading, genresError] = useFetch<undefined, Genre[]>({
    dataType: "genres",
    watch: [],
    params: undefined,
    fetchFunction: async () =>
      (
        await metadataApi.listGenres(0, 500, { field: "name", order: "desc" })
      ).data.genres.filter((genre) => genre.type === "Movie"),
  });

  useEffect(() => {
    const newFilters: FilterDefinition[] = [];

    if (debouncedTitleFilter.length >= 3) {
      newFilters.push({
        type: "ilike",
        name: "title",
        value: `%${debouncedTitleFilter}%`,
      });
    }

    if (statusFilter.length > 0) {
      newFilters.push({
        type: "in",
        name: "status",
        value: statusFilter,
      });
    }

    if (videoFilter.length > 0) {
      const allSelected = ["f", "v"].every((value: "f" | "v") =>
        videoFilter.includes(value),
      );

      if (!allSelected) {
        newFilters.push({
          type: "eq",
          name: "video",
          // If the first element is "a" - alive, we want to make sure that the deathday is null
          // otherwise, it must be set for a deceased person
          value: videoFilter[0] === "v",
        });
      }
    }

    if (genresFilter.length > 0) {
      if (genreFilterLogic === "or") {
        newFilters.push({
          type: "in",
          name: "genres.genreId",
          value: genresFilter,
        });
      } else {
        newFilters.push({
          type: "and",
          name: "_and",
          value: genresFilter.map<FilterDefinition>((value) => {
            return {
              type: "eq",
              name: "genres.genreId",
              value: value,
            };
          }),
        });
      }
    }

    if (runtimeFilter.length === 2) {
      newFilters.push({
        type: "and",
        name: "__runtime_and",
        value: [
          {
            type: "lte",
            name: "runtime",
            value: runtimeFilter[1],
          },
          {
            type: "gte",
            name: "runtime",
            value: runtimeFilter[0],
          },
        ],
      });
    }

    if (spokenLanguageFilter.length > 0) {
      newFilters.push({
        type: "in",
        name: "spokenLanguages.languageCode",
        value: spokenLanguageFilter,
      });
    }

    if (originalLanguageFilter.length > 0) {
      newFilters.push({
        type: "in",
        name: "originalLanguageCode",
        value: originalLanguageFilter,
      });
    }

    if (releaseDateFilter) {
      const startDate = DateTime.fromObject({
        month: releaseDateFilter.start.month,
        year: releaseDateFilter.start.year,
      });
      const endDate = DateTime.fromObject({
        month: releaseDateFilter.end.month,
        year: releaseDateFilter.end.year,
      });
      newFilters.push({
        type: "and",
        name: "_",
        value: [
          { type: "gte", name: "releaseDate", value: startDate.toISODate()! },
          { type: "lte", name: "releaseDate", value: endDate.toISODate()! },
        ],
      });
    }

    if (missingFilter.length === 1) {
      newFilters.push({
        type: "exists",
        name: "asset",
        value: missingFilter[0] === "y",
      });
    }

    if (monitoredFilter) {
      newFilters.push({
        type: "eq",
        name: "searchConfiguration.enabled",
        value: true,
      });
    }

    if (favoriteFilter) {
      newFilters.push({
        type: "exists",
        name: "favorite",
        value: true,
      });
    }

    if (newFilters.length > 1) {
      onFiltersSet({ type: "and", name: "__base", value: newFilters });
    } else {
      onFiltersSet(newFilters[0]);
    }
  }, [
    debouncedTitleFilter,
    statusFilter,
    videoFilter,
    genresFilter,
    spokenLanguageFilter,
    releaseDateFilter,
    runtimeFilter,
    monitoredFilter,
    favoriteFilter,
    missingFilter,
    originalLanguageFilter,
  ]);

  return (
    <Space
      orientation={"horizontal"}
      size={8}
      style={{
        backgroundColor: "#efefef",
        width: "100%",
        justifyContent: "space-between",
        padding: 8,
      }}
    >
      <Space orientation={"horizontal"} size={8}>
        <Input
          size={"small"}
          prefix={
            <FilterFilled
              style={{
                color:
                  debouncedTitleFilter?.length >= 3 ? "#1677ff" : "#afafaf",
              }}
            />
          }
          placeholder={"Search by title"}
          allowClear={true}
          style={{
            width: 500,
            background: "#ffffff",
            borderColor: "#efefef",
          }}
          value={titleFilter}
          onChange={(e) => {
            setTitleFilter(e.target.value);
          }}
        />
        <CheckboxFilter
          label={"Status"}
          initialValues={statusFilter}
          items={[
            "Released",
            "Post Production",
            "In Production",
            "Planned",
            "Rumored",
            "Canceled",
          ].map((item) => {
            const [statusText, statusColor] = getReleaseStatusForMovie(item);

            return {
              key: statusText,
              label: (
                <Tag color={statusColor} style={{ minWidth: 120 }}>
                  {statusText}
                </Tag>
              ),
            };
          })}
          onFiltersSet={(values) => {
            setStatusFilter(values as string[]);
          }}
        />
        <CheckboxFilter
          label={"Type"}
          initialValues={videoFilter}
          items={[
            { key: "f", label: "Feature" },
            { key: "v", label: "Video" },
          ]}
          onFiltersSet={(values) => {
            setVideoFilter(values as ("f" | "v")[]);
          }}
        />
        <DateRangeFilter
          initialValue={releaseDateFilter}
          label={"Release Date"}
          onFiltersSet={setReleaseDateFilter}
        />
        <CheckboxFilter
          label={"Genre"}
          items={
            genres?.length > 0
              ? genres.map((genre) => {
                  return {
                    key: genre.id,
                    label: <Typography.Text>{genre.name}</Typography.Text>,
                  };
                })
              : []
          }
          onFiltersSet={(values) => {
            setGenresFilter(values as string[]);
          }}
        />
        <DurationFilter label={"Runtime"} onFiltersSet={setRuntimeFilter} />
        <CheckboxFilter
          label={"Spoken Language"}
          items={
            languages?.length > 0
              ? languages.map((language) => {
                  return {
                    key: language.id,
                    label: (
                      <Space orientation={"horizontal"} size={8}>
                        <ReactCountryFlag
                          countryCode={language.id}
                          cdnUrl={"/flags/"}
                          cdnSuffix={"svg"}
                          svg={true}
                        />
                        <Typography.Text>{language.name}</Typography.Text>
                      </Space>
                    ),
                  };
                })
              : []
          }
          onFiltersSet={(values) => {
            setSpokenLanguageFilter(values as string[]);
          }}
        />
        <CheckboxFilter
          label={"Original Language"}
          items={
            languages?.length > 0
              ? languages.map((language) => {
                  return {
                    key: language.id,
                    label: (
                      <Space orientation={"horizontal"} size={8}>
                        <ReactCountryFlag
                          countryCode={language.id}
                          cdnUrl={"/flags/"}
                          cdnSuffix={"svg"}
                          svg={true}
                        />
                        <Typography.Text>{language.name}</Typography.Text>
                      </Space>
                    ),
                  };
                })
              : []
          }
          onFiltersSet={(values) => {
            setOriginalLanguageFilter(values as string[]);
          }}
        />
      </Space>
      <Space orientation={"horizontal"} size={8} align={"center"}>
        <CheckboxFilter
          label={"Asset"}
          initialValues={[]}
          items={[
            { key: "y", label: "In Library" },
            { key: "n", label: "Not in Library" },
          ]}
          onFiltersSet={(values) => {
            setMissingFilter(values as string[]);
          }}
        />
        <Typography.Text style={{ fontSize: "12px" }}>
          <EyeFilled
            style={{
              fontSize: "18px",
              color: monitoredFilter ? "#1672f3" : "#afafaf",
            }}
          />
        </Typography.Text>
        <Switch
          size={"small"}
          checked={monitoredFilter}
          onChange={setMonitoredFilter}
        />
        <Typography.Text style={{ fontSize: "12px" }}>
          <HeartFilled
            style={{
              fontSize: "18px",
              color: favoriteFilter ? "#1672f3" : "#afafaf",
            }}
          />
        </Typography.Text>
        <Switch
          size={"small"}
          checked={favoriteFilter}
          onChange={setFavoriteFilter}
        />
        <Sorter
          initialSort={initialSort.field}
          initialDirection={initialSort.order}
          sortOptions={{
            popularity: "Popularity",
            title: "Title",
            releaseDate: "Release Date",
            budget: "Budget",
            revenue: "Revenue",
            status: "Status",
          }}
          onSortChange={(sort, direction) => {
            onSortSet({
              field: sort,
              order: direction,
            });
          }}
        />
      </Space>
    </Space>
  );
};
export default MovieFilterBar;
