import { Content } from "antd/lib/layout/layout";
import HomeColumns from "../components/home/HomeColumns";
import WeatherWidget from "../components/widgets/weather/WeatherWidget";

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
        <HomeColumns>
          <div>Somewhere! Over the rainbow</div>
          <div />
          <WeatherWidget />
        </HomeColumns>
      </Content>
    </Content>
  );
};

export default IndexPage;
