import { RedocStandalone } from "redoc";

const DocsPage: React.FunctionComponent = () => {
  return (
    <RedocStandalone
      specUrl={"/api-spec-json"}
      options={{
        theme: {
          colors: { primary: { main: "#001529" } },
          rightPanel: {
            backgroundColor: "#9aa4ae",
          },
        },
      }}
    />
  );
};

export default DocsPage;
