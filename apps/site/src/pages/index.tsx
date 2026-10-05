import { Flex } from "antd";
import { Content } from "antd/lib/layout/layout";
import HomeColumns from "../components/home/HomeColumns";
import CalendarWidget from "../components/widgets/calendar/CalendarWidget";
import GoalsWidget from "../components/widgets/goals/GoalsWidget";
import ReviewWidget from "../components/widgets/review/ReviewWidget";
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
          <Flex vertical={true} gap={16}>
            <ReviewWidget />
            <GoalsWidget />
          </Flex>
          <CalendarWidget />
          <WeatherWidget />
        </HomeColumns>
      </Content>
    </Content>
  );
};

export default IndexPage;
