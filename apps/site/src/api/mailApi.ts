import {
  client,
  getMailStatistics,
  type MailStatisticsRange,
  type MailStatisticsScope,
} from "@ncfritz/olympus-sdk/minerva";

/** Mail (ADR 0030): the caller's own mail, through the API. */
class MailApi {
  constructor() {
    client.setConfig({
      baseURL: "/api/v1",
      throwOnError: true,
    });
  }

  async getStatistics(range: MailStatisticsRange, scope: MailStatisticsScope) {
    return await getMailStatistics({ query: { range, scope } });
  }
}

const mailApi = new MailApi();

export default mailApi;
