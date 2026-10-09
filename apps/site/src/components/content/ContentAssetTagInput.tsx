import type {
  ContentAssetTag,
  ContentTagType,
} from "@ncfritz/olympus-sdk/dionysus";
import React, { type CSSProperties, useEffect, useState } from "react";
import contentApi from "../../api/contentApi";
import { useFetch } from "../../hooks/useFetch";
import LoadingWrapper from "../common/LoadingWrapper";
import ContentAssetTagSelector from "./ContentAssetTagSelector";

export interface ContentAssetTagInputProps {
  onChange: (tags: ContentAssetTag[]) => void;
  defaultValue?: string[];
  allowAdd?: boolean;
  titleStyle?: CSSProperties;
}

const ContentAssetTagInput: React.FunctionComponent<
  ContentAssetTagInputProps
> = ({
  allowAdd = true,
  titleStyle,
  onChange,
  defaultValue,
}: ContentAssetTagInputProps) => {
  const [processedTags, setProcessedTags] = useState<
    Record<ContentTagType, ContentAssetTag[]>
  >({ type: [], system: [], source: [], model: [], user: [] });
  const [initialized, setInitialized] = useState(false);
  const [selectedTags, setSelectedTags] = useState<ContentAssetTag[]>([]);

  const [tags, tagsLoading, tagsError, fetchTags] = useFetch<
    undefined,
    ContentAssetTag[]
  >({
    dataType: "content asset tags",
    params: undefined,
    fetchFunction: async () => {
      return (await contentApi.listTags()).data.tags;
    },
  });

  useEffect(() => {
    const sortedTags: Record<ContentTagType, ContentAssetTag[]> = {
      system: [],
      model: [],
      user: [],
      source: [],
      type: [],
    };

    if (!tags) {
      return;
    }

    const initialTags: ContentAssetTag[] = [];

    tags.forEach((tag) => {
      if (!initialized && defaultValue && defaultValue.includes(tag.id)) {
        initialTags.push(tag);
      }

      if (!Object.keys(sortedTags).includes(tag.type)) {
        return;
      }
      sortedTags[tag.type].push(tag);
    });

    if (!initialized) {
      setSelectedTags(initialTags);
      setInitialized(true);
    }

    Object.keys(sortedTags).forEach((key) => {
      sortedTags[key as ContentTagType].sort((a, b) => {
        const nameA = a.name.toUpperCase(); // ignore upper and lowercase
        const nameB = b.name.toUpperCase(); // ignore upper and lowercase

        return nameA === nameB ? 0 : nameA < nameB ? -1 : 1;
      });
    });

    setProcessedTags(sortedTags);
  }, [tags]);

  useEffect(() => {
    if (initialized) {
      onChange(selectedTags);
    }
  }, [selectedTags]);

  return (
    <LoadingWrapper
      loading={tagsLoading}
      error={tagsError}
      style={{ height: "inherit" }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          rowGap: 6,
          height: "inherit",
        }}
      >
        {Object.keys(processedTags).map((key) => {
          return (
            <ContentAssetTagSelector
              key={`cats-${key}`}
              title={key.charAt(0).toUpperCase() + key.slice(1)}
              type={key as ContentTagType}
              tags={processedTags[key as ContentTagType]}
              allowAdd={allowAdd}
              allowFilter={true}
              onSelectTag={async (tag) => {
                if (!selectedTags.includes(tag)) {
                  setSelectedTags([...selectedTags, tag]);
                }
              }}
              onRemoveTag={async (tag) => {
                setSelectedTags(
                  selectedTags.filter((current) => {
                    return tag.id !== current.id;
                  }),
                );
              }}
              afterAdd={async () => {
                await fetchTags(true);
              }}
              titleStyle={titleStyle}
              initialTags={selectedTags.map((tag) => tag.id)}
            />
          );
        })}
        <div
          style={{
            paddingLeft: 16,
            marginLeft: 16,
            borderLeft: "1px solid #efefef",
          }}
        >
          <ContentAssetTagSelector
            allowAdd={false}
            title={"Selected"}
            type={"selected"}
            tags={selectedTags}
            onRemoveTag={async (tag) => {
              setSelectedTags(
                selectedTags.filter((current) => {
                  return tag.id !== current.id;
                }),
              );
            }}
            initialTags={selectedTags.map((tag) => tag.id)}
            titleStyle={{ ...titleStyle, paddingBottom: 40 }}
            allowClear={true}
          />
        </div>
      </div>
    </LoadingWrapper>
  );
};
export default ContentAssetTagInput;
