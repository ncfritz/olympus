import { Col, Row } from "antd";
import { Content } from "antd/lib/layout/layout";
import WeatherForecastWidget from "../components/widgets/weather/WeatherForecastWidget";

const IndexPage: React.FunctionComponent = () => {
  return (
    <Content
      style={{
        background: "#fff",
      }}
    >
      <Content
        style={{
          margin: 16,
        }}
      >
        <Row>
          <Col span={14}>fff</Col>
          <Col span={10}>
            <WeatherForecastWidget />
          </Col>
        </Row>
      </Content>
    </Content>
  );
};

export default IndexPage;
