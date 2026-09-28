import { useRouter } from "next/router";
import { RedocStandalone } from "redoc";
import LoadingWrapper from "../../components/common/LoadingWrapper";

const DocsPage: React.FunctionComponent = () => {
  const router = useRouter();
  const { id } = router.query;

  console.log(router.query);

  return (
    <LoadingWrapper loading={id === undefined}>
      <RedocStandalone
        specUrl={`/${id}/api-spec-json`}
        options={{
          theme: {
            colors: { primary: { main: "#001529" } },
            rightPanel: {
              backgroundColor: "#9aa4ae",
            },
          },
        }}
      />
    </LoadingWrapper>
  );
};

export default DocsPage;
