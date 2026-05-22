import { sendAmqpTestMessage } from "@ncfritz/olympus-sdk/olympus";
import { client } from "@ncfritz/olympus-sdk/minerva";

class AdminApi {
  constructor() {
    client.setConfig({
      baseURL: "/api/v1",
      throwOnError: true,
    });
  }

  async sendAmqpTestMessage(
    exchange: string,
    payload: any,
    routingKey?: string,
  ) {
    await sendAmqpTestMessage({
      path: {
        exchange: exchange,
      },
      query: {
        routingKey: routingKey,
      },
      body: payload,
    });
  }
}

const adminaApi = new AdminApi();
export default adminaApi;
