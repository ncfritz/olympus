import { RedocStandalone } from "redoc";

const DocsPage: React.FunctionComponent = () => {
  return (
    <RedocStandalone
      specUrl={"/api-spec-json"}
      options={{
        theme: {
          colors: { primary: { main: "#001529" } },
          rightPanel: {
            backgroundColor: "#022d55",
          },
        },
      }}
    />
  );
};

export default DocsPage;
