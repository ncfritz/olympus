import { Content } from "antd/lib/layout/layout";
import HomeColumns from "../components/home/HomeColumns";
import GoalsWidget from "../components/widgets/goals/GoalsWidget";
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
          <GoalsWidget />
          <div />
          <WeatherWidget />
        </HomeColumns>
      </Content>
    </Content>
  );
};

export default IndexPage;
