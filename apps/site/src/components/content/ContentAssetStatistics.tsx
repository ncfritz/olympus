import { Col, Row, Statistic } from "antd";
import prettyBytes from "pretty-bytes";
import prettyMilliseconds from "pretty-ms";
import React, { useEffect, useState } from "react";
import type { ContentStatisticsResponse } from "@ncfritz/olympus-sdk/dionysus";
import contentApi from "../../api/contentApi";
import { useAppSelector } from "../../redux/hooks";
import ContentDimensionGraph from "./ContentDimensionGraph";

/** What a content statistics call returns; the SDK exports no name for it. */
/**
 * What the aggregate statistics endpoint actually returns, copied from the API's
 * own `ContentAssetAggregateStatistics` (apps/api, ContentAssetService).
 *
 * Not from the SDK, because the SDK is wrong here: that controller's
 * `@ApiOkResponse` declares `ContentStatisticsResponse` -- the categories-and-
 * series shape the four distribution endpoints return -- so the generated client
 * describes this endpoint as returning something it does not. Typing this
 * component is what found it; docs/roadmap.md carries the fix.
 */
type AggregateStatistics = {
  count: number;
  minSize: number;
  maxSize: number;
  avgSize: number;
  totalSize: number;
  minDuration: number;
  maxDuration: number;
  avgDuration: number;
  totalDuration: number;
};

const ContentAssetStatistics: React.FunctionComponent = () => {
  const blackCurtainEnabled = useAppSelector(
    (state) => state.blackCurtain.active,
  );

  const [loading, setLoading] = useState(true);
  const [heightStatistics, setHeightStatistics] = useState<
    ContentStatisticsResponse | undefined
  >(undefined);
  const [widthStatistics, setWidthStatistics] = useState<
    ContentStatisticsResponse | undefined
  >(undefined);
  const [durationStatistics, setDurationStatistics] = useState<
    ContentStatisticsResponse | undefined
  >(undefined);
  const [sizeStatistics, setSizeStatistics] = useState<
    ContentStatisticsResponse | undefined
  >(undefined);
  const [aggregateStatistics, setAggregateStatistics] = useState<
    AggregateStatistics | undefined
  >(undefined);

  const fetchAssetStatistics = async () => {
    setLoading(true);

    try {
      const [
        heightStatisticsResponse,
        widthStatisticsResponse,
        durationStatisticsResponse,
        sizeStatisticsResponse,
        aggregateStatisticsResponse,
      ] = await Promise.all([
        contentApi.getAssetHeightStatistics(),
        contentApi.getAssetWidthStatistics(),
        contentApi.getAssetDurationStatistics(),
        contentApi.getAssetSizeStatistics(),
        contentApi.getAssetAggregateStatistics(),
      ]);

      setHeightStatistics(heightStatisticsResponse.data);
      setWidthStatistics(widthStatisticsResponse.data);
      setDurationStatistics(durationStatisticsResponse.data);
      setSizeStatistics(sizeStatisticsResponse.data);
      // The cast is the spec bug above: the SDK types this response as
      // `ContentStatisticsResponse`, and the endpoint does not return that.
      setAggregateStatistics(
        aggregateStatisticsResponse.data as unknown as AggregateStatistics,
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await fetchAssetStatistics();
    })();
  }, [blackCurtainEnabled]);

  return (
    <>
      <Row>
        <Col span={6}>
          <ContentDimensionGraph
            loading={loading}
            title={"Duration"}
            data={durationStatistics}
            height={200}
          />
        </Col>
        <Col span={6}>
          <ContentDimensionGraph
            loading={loading}
            title={"Size"}
            data={sizeStatistics}
            height={200}
          />
        </Col>
        <Col span={6}>
          <ContentDimensionGraph
            loading={loading}
            title={"Height"}
            data={heightStatistics}
            height={200}
          />
        </Col>
        <Col span={6}>
          <ContentDimensionGraph
            loading={loading}
            title={"Width"}
            data={widthStatistics}
            height={200}
          />
        </Col>
      </Row>
      <Row
        style={{
          borderTop: "1px solid #f0f0f0",
        }}
      >
        <Col span={2} style={{ borderRight: "1px solid #f0f0f0", padding: 16 }}>
          <Statistic
            title={"Count"}
            value={loading ? 0 : (aggregateStatistics?.count ?? 0)}
            loading={loading}
          />
        </Col>
        <Col span={2} style={{ borderRight: "1px solid #f0f0f0", padding: 16 }}>
          <Statistic
            title={"Min Size"}
            value={loading ? 0 : prettyBytes(aggregateStatistics?.minSize ?? 0)}
            loading={loading}
          />
        </Col>
        <Col span={3} style={{ borderRight: "1px solid #f0f0f0", padding: 16 }}>
          <Statistic
            title={"Max Size"}
            value={loading ? 0 : prettyBytes(aggregateStatistics?.maxSize ?? 0)}
            loading={loading}
          />
        </Col>
        <Col span={3} style={{ borderRight: "1px solid #f0f0f0", padding: 16 }}>
          <Statistic
            title={"Avg Size"}
            value={loading ? 0 : prettyBytes(aggregateStatistics?.avgSize ?? 0)}
            loading={loading}
          />
        </Col>
        <Col span={2} style={{ borderRight: "1px solid #f0f0f0", padding: 16 }}>
          <Statistic
            title={"Total Size"}
            value={
              loading ? 0 : prettyBytes(aggregateStatistics?.totalSize ?? 0)
            }
            loading={loading}
          />
        </Col>
        <Col span={3} style={{ borderRight: "1px solid #f0f0f0", padding: 16 }}>
          <Statistic
            title={"Min Duration"}
            value={
              loading
                ? 0
                : prettyMilliseconds(aggregateStatistics?.minDuration ?? 0)
            }
            loading={loading}
          />
        </Col>
        <Col span={3} style={{ borderRight: "1px solid #f0f0f0", padding: 16 }}>
          <Statistic
            title={"Max Duration"}
            value={
              loading
                ? 0
                : prettyMilliseconds(aggregateStatistics?.maxDuration ?? 0)
            }
            loading={loading}
          />
        </Col>
        <Col span={3} style={{ borderRight: "1px solid #f0f0f0", padding: 16 }}>
          <Statistic
            title={"Avg Duration"}
            value={
              loading
                ? 0
                : prettyMilliseconds(aggregateStatistics?.avgDuration ?? 0)
            }
            loading={loading}
          />
        </Col>
        <Col span={3} style={{ padding: 16 }}>
          <Statistic
            title={"Total Duration"}
            value={
              loading
                ? 0
                : prettyMilliseconds(aggregateStatistics?.totalDuration ?? 0)
            }
            loading={loading}
          />
        </Col>
      </Row>
    </>
  );
};
export default ContentAssetStatistics;
