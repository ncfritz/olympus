import {
  ExperimentOutlined,
  HomeOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import type {
  ContentAssetTag,
  FilterDefinition,
} from "@ncfritz/olympus-sdk/dionysus";
import { Drawer, Space, Splitter } from "antd";
import { Content } from "antd/lib/layout/layout";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import ContentAssetDetailsPanel from "../../../components/content/ContentAssetDetailsPanel";
import ContentAssetFilterPanel from "../../../components/content/ContentAssetFilterPanel";
import ContentAssetStatistics from "../../../components/content/ContentAssetStatistics";
import ContentAssetTable from "../../../components/content/ContentAssetTable";
import ContentAuthWrapper from "../../../components/content/ContentAuthWrapper";
import OlympusBreadcrumbs from "../../../components/layout/OlympusBreadcrumbs";

const ContentAssetsPage: React.FunctionComponent = () => {
  const [assetPanelTarget, setAssetPanelTarget] = useState<string | undefined>(
    undefined,
  );
  const [filterPanelSize, setFilterPanelSize] = useState(300);
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [nameFilter, setNameFilter] = useState("");
  const [ratingFilter, setRatingFilter] = useState<number | undefined>(
    undefined,
  );
  const [durationFilter, setDurationFilter] = useState<number[] | undefined>(
    undefined,
  );
  const [resolutionFilter, setResolutionFilter] = useState<
    number[] | undefined
  >(undefined);
  const [filters, setFilters] = useState<FilterDefinition | undefined>(
    undefined,
  );

  const addTagFilter = async (tag: ContentAssetTag) => {
    const key = `${tag.type}:${tag.name}`;

    if (!tagFilters.includes(key)) {
      const newFilters = [...tagFilters];
      newFilters.push(key);

      setTagFilters(newFilters);
    }
  };

  const removeTagFilter = async (tag: ContentAssetTag) => {
    const key = `${tag.type}:${tag.name}`;

    if (tagFilters.includes(key)) {
      const newFilters = [...tagFilters].filter((value) => {
        return value !== key;
      });

      setTagFilters(newFilters);
    }
  };

  const toggleFilters = () => {
    setFilterPanelSize(filterPanelSize <= 0 ? 300 : 0);
  };

  const appendTagFilterDefinition = (
    type: string,
    logic: "and" | "or",
    chain: FilterDefinition[],
  ) => {
    const selectedValues = tagFilters
      .filter((value) => value.startsWith(`${type}:`))
      .map((value) => value.substring(value.indexOf(":") + 1, value.length));
    let values: string[] | FilterDefinition[] = selectedValues;

    if (logic === "and") {
      values = selectedValues.map<FilterDefinition>((value) => {
        return {
          type: "eq",
          name: "asset_tags.tag.name",
          value: value,
        };
      });
    }

    if (selectedValues.length > 0) {
      chain.push({
        type: "and",
        name: "__and",
        value: [
          {
            type: "eq",
            name: "asset_tags.tag.type",
            value: type,
          },
          {
            type: logic === "and" ? "and" : "in",
            name: logic === "and" ? "__and" : "asset_tags.tag.name",
            value: values,
          },
        ],
      });
    }
  };

  useEffect(() => {
    const newFilters: FilterDefinition[] = [];
    appendTagFilterDefinition("type", "or", newFilters);
    appendTagFilterDefinition("source", "or", newFilters);
    appendTagFilterDefinition("user", "and", newFilters);
    appendTagFilterDefinition("model", "or", newFilters);
    appendTagFilterDefinition("system", "and", newFilters);

    if (ratingFilter) {
      newFilters.push({
        name: "rating",
        type: "gte",
        value: ratingFilter,
      });
    }

    if (nameFilter) {
      newFilters.push({
        name: "_or",
        type: "or",
        value: [
          {
            name: "original_name",
            type: "ilike",
            value: `%${nameFilter}%`,
          },
          {
            name: "name",
            type: "ilike",
            value: `%${nameFilter}%`,
          },
        ],
      });
    }

    if (durationFilter) {
      newFilters.push({
        name: "_and",
        type: "and",
        value: [
          {
            name: "duration",
            type: "gte",
            value: durationFilter[0],
          },
          {
            name: "duration",
            type: "lte",
            value: durationFilter[1],
          },
        ],
      });
    }

    if (resolutionFilter) {
      newFilters.push({
        name: "_and",
        type: "and",
        value: [
          {
            name: "height",
            type: "gte",
            value: resolutionFilter[0],
          },
          {
            name: "height",
            type: "lte",
            value: resolutionFilter[1],
          },
        ],
      });
    }

    if (newFilters.length > 1) {
      setFilters({ type: "and", name: "__base", value: newFilters });
    } else {
      setFilters(newFilters[0]);
    }
  }, [tagFilters, nameFilter, ratingFilter, durationFilter, resolutionFilter]);

  return (
    <ContentAuthWrapper>
      <OlympusBreadcrumbs
        items={[
          {
            title: (
              <Link href={"/"}>
                <Space size={4}>
                  <HomeOutlined />
                  <span>Home</span>
                </Space>
              </Link>
            ),
          },
          {
            title: (
              <Link href={"/dionysus"}>
                <Space size={4}>
                  <VideoCameraOutlined />
                  <span>Dionysus</span>
                </Space>
              </Link>
            ),
          },
          {
            title: (
              <Link href={"/dionysus/content"}>
                <Space size={4}>
                  <ExperimentOutlined />
                  <span>Content</span>
                </Space>
              </Link>
            ),
          },
          {
            title: (
              <Space>
                <VideoCameraOutlined />
                <span>Assets</span>
              </Space>
            ),
          },
        ]}
      />
      <Content
        style={{
          height: "calc(100vh - 102px)",
          overflowX: "hidden",
          overflowY: "auto",
          marginTop: 28,
        }}
      >
        <ContentAssetStatistics />
        <Splitter
          style={{
            height: "calc(100vh - 399px)",
          }}
          onResize={(sizes) => {
            setFilterPanelSize(filterPanelSize <= 0 ? 300 : 0);
          }}
        >
          <Splitter.Panel
            min={0}
            max={300}
            size={filterPanelSize}
            resizable={false}
            collapsible={true}
            style={{
              scrollbarWidth: "none",
            }}
          >
            <ContentAssetFilterPanel
              togglePanel={toggleFilters}
              onSelectTag={addTagFilter}
              onRemoveTag={removeTagFilter}
              onNameChange={setNameFilter}
              onRatingChange={setRatingFilter}
              onDurationChange={setDurationFilter}
              onResolutionChange={setResolutionFilter}
            />
          </Splitter.Panel>
          <Splitter.Panel>
            <ContentAssetTable
              filters={filters}
              initialSort={{
                field: "createdTime",
                order: "desc",
              }}
              onInfoButtonClick={(record) => {
                setAssetPanelTarget(record.id);
              }}
              onSearchButtonClick={toggleFilters}
              searchButtonVisible={filterPanelSize > 0}
              scrollY={"calc(100vh - 494px)"}
            />
          </Splitter.Panel>
        </Splitter>
        <Drawer
          title={"Asset Details"}
          width={750}
          placement={"right"}
          closable={true}
          styles={{
            body: {
              padding: 0,
            },
          }}
          onClose={() => {
            setAssetPanelTarget(undefined);
          }}
          open={assetPanelTarget !== undefined}
        >
          <ContentAssetDetailsPanel assetId={assetPanelTarget!} />
        </Drawer>
      </Content>
    </ContentAuthWrapper>
  );
};

export default ContentAssetsPage;
