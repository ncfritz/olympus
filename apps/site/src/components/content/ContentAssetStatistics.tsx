import { Col, Row, Statistic } from "antd";
import prettyBytes from "pretty-bytes";
import prettyMilliseconds from "pretty-ms";
import React, { useEffect, useState } from "react";
import contentApi from "../../api/contentApi";
import { useAppSelector } from "../../redux/hooks";
import ContentDimensionGraph from "./ContentDimensionGraph";

const ContentAssetStatistics: React.FunctionComponent = () => {
  const blackCurtainEnabled = useAppSelector(
    (state) => state.blackCurtain.active,
  );

  const [loading, setLoading] = useState(true);
  const [heightStatistics, setHeightStatistics] = useState<any>(undefined);
  const [widthStatistics, setWidthStatistics] = useState<any>(undefined);
  const [durationStatistics, setDurationStatistics] = useState<any>(undefined);
  const [sizeStatistics, setSizeStatistics] = useState<any>(undefined);
  const [aggregateStatistics, setAggregateStatistics] =
    useState<any>(undefined);

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
      setAggregateStatistics(aggregateStatisticsResponse.data);
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
            value={loading ? 0 : aggregateStatistics.count}
            loading={loading}
          />
        </Col>
        <Col span={2} style={{ borderRight: "1px solid #f0f0f0", padding: 16 }}>
          <Statistic
            title={"Min Size"}
            value={loading ? 0 : prettyBytes(aggregateStatistics.minSize)}
            loading={loading}
          />
        </Col>
        <Col span={3} style={{ borderRight: "1px solid #f0f0f0", padding: 16 }}>
          <Statistic
            title={"Max Size"}
            value={loading ? 0 : prettyBytes(aggregateStatistics.maxSize)}
            loading={loading}
          />
        </Col>
        <Col span={3} style={{ borderRight: "1px solid #f0f0f0", padding: 16 }}>
          <Statistic
            title={"Avg Size"}
            value={loading ? 0 : prettyBytes(aggregateStatistics.avgSize)}
            loading={loading}
          />
        </Col>
        <Col span={2} style={{ borderRight: "1px solid #f0f0f0", padding: 16 }}>
          <Statistic
            title={"Total Size"}
            value={loading ? 0 : prettyBytes(aggregateStatistics.totalSize)}
            loading={loading}
          />
        </Col>
        <Col span={3} style={{ borderRight: "1px solid #f0f0f0", padding: 16 }}>
          <Statistic
            title={"Min Duration"}
            value={
              loading ? 0 : prettyMilliseconds(aggregateStatistics.minDuration)
            }
            loading={loading}
          />
        </Col>
        <Col span={3} style={{ borderRight: "1px solid #f0f0f0", padding: 16 }}>
          <Statistic
            title={"Max Duration"}
            value={
              loading ? 0 : prettyMilliseconds(aggregateStatistics.maxDuration)
            }
            loading={loading}
          />
        </Col>
        <Col span={3} style={{ borderRight: "1px solid #f0f0f0", padding: 16 }}>
          <Statistic
            title={"Avg Duration"}
            value={
              loading ? 0 : prettyMilliseconds(aggregateStatistics.avgDuration)
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
                : prettyMilliseconds(aggregateStatistics.totalDuration)
            }
            loading={loading}
          />
        </Col>
      </Row>
    </>
  );
};
export default ContentAssetStatistics;
