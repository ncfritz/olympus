import { GlobalOutlined } from "@ant-design/icons";
import { TileLayer } from "@deck.gl/geo-layers";
import { BitmapLayer } from "@deck.gl/layers";
import { Map } from "@vis.gl/react-google-maps";
import { Button, Card, Popover, Space, Tabs, Typography } from "antd";
import { useState } from "react";
import { STYLE_SHIFT_WORKER } from "../../../utils/maps";
import { WeatherMapOverlay } from "./WeatherMapOverlay";

const locations: Record<string, any> = {
  az: {
    label: "Arizona",
    location: {
      lat: 33.3166975,
      lng: -111.9558455,
    },
  },
  wa: {
    label: "Washington",
    location: {
      lat: 47.8525684,
      lng: -122.238287,
    },
  },
  hi: {
    label: "Hawai'i - Kona",
    location: {
      lat: 19.6106071,
      lng: -155.9723704,
    },
  },
  ba: {
    label: "Bath - England",
    location: {
      lat: 51.383618,
      lng: -2.373979,
    },
  },
};

const WeatherForecastWidget: React.FunctionComponent = () => {
  const [locationPopoverOpen, setLocationPopoverOpen] = useState(false);
  const [location, setLocation] = useState("az");
  const [mapViewType, setMapViewType] = useState("precipitation");

  const popoverContent = [];

  for (const key in locations) {
    popoverContent.push(
      <Button
        type={"text"}
        onClick={() => {
          setLocation(key);
          setLocationPopoverOpen(false);
        }}
        style={{ width: "100%", textAlign: "left" }}
        disabled={key === location}
      >
        {locations[key].label}
      </Button>,
    );
  }

  const weatherMapTileLayer = new TileLayer({
    data: `https://api.tomorrow.io/v4/map/tile/{z}/{x}/{y}/${mapViewType}/now.png?apikey=GNNX5smBVKHSrp0BeOEWzjWkKGZ5Kpe0`,
    minZoom: 0,
    maxZoom: 19,
    tileSize: 256,
    opacity: 0.33,

    renderSubLayers: (props) => {
      const { boundingBox } = props.tile;

      return new BitmapLayer(props, {
        data: undefined,
        image: props.data,
        bounds: [
          boundingBox[0][0],
          boundingBox[0][1],
          boundingBox[1][0],
          boundingBox[1][1],
        ],
      });
    },
  });

  return (
    <Card
      style={{
        border: 0,
      }}
      styles={{
        header: {
          borderBottomWidth: 3,
          borderColor: "#004673",
          padding: 8,
          paddingBottom: 0,
          alignItems: "center",
        },
        body: {
          padding: 8,
        },
      }}
      title={
        <Space
          direction={"horizontal"}
          style={{
            display: "flex",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <Typography.Title level={5}>Weather</Typography.Title>
          <Popover
            content={
              <Space direction={"vertical"} style={{ width: "100%" }}>
                {popoverContent}
              </Space>
            }
            title={"Select location"}
            trigger={"click"}
            placement={"leftTop"}
            open={locationPopoverOpen}
            onOpenChange={(value) => {
              setLocationPopoverOpen(value);
            }}
          >
            <Button icon={<GlobalOutlined />} type={"text"} />
          </Popover>
        </Space>
      }
    >
      <Space
        direction={"vertical"}
        size={8}
        styles={{
          item: {
            display: "flex",
          },
        }}
        style={{
          width: "100%",
        }}
      >
        <Space>Forecast</Space>
        <div style={{ width: "100%", display: "flex" }}>
          <Map
            center={locations[location].location}
            defaultZoom={10}
            styles={STYLE_SHIFT_WORKER}
            gestureHandling={"none"}
            fullscreenControl={false}
            streetViewControl={false}
            mapTypeControl={false}
            keyboardShortcuts={false}
            maxZoom={15}
            minZoom={8}
          >
            <WeatherMapOverlay layers={weatherMapTileLayer} />
          </Map>
          <Tabs
            className={"compactTabs noHolder"}
            defaultActiveKey={"weather-tab-precipitation"}
            tabPosition={"right"}
            size={"small"}
            tabBarStyle={{
              flexShrink: 1,
            }}
            onChange={(key: string) => {
              const viewType = key.substring(
                key.lastIndexOf("-") + 1,
                key.length,
              );
              setMapViewType(viewType);
            }}
            items={[
              { key: "weather-tab-temperature", label: "Temperature" },
              { key: "weather-tab-dewPoint", label: "Dew Point" },
              { key: "weather-tab-humidity", label: "Humidity" },
              { key: "weather-tab-windSpeed", label: "Wind Speed" },
              {
                key: "weather-tab-windDirection",
                label: "Wind Direction",
              },
              { key: "weather-tab-windGust", label: "Wind Gusts" },
              { key: "weather-tab-pressure", label: "Pressure" },
              {
                key: "weather-tab-precipitation",
                label: "Precipitation",
              },
              { key: "weather-tab-visibility", label: "Visibility" },
              { key: "weather-tab-cloudCover", label: "Cloud Cover" },
              { key: "weather-tab-cloudBase", label: "Cloud Base" },
              {
                key: "weather-tab-cloudCeiling",
                label: "Cloud Ceiling",
              },
            ]}
          />
        </div>
      </Space>
    </Card>
  );
};
export default WeatherForecastWidget;
