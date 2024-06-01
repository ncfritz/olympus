import axios from "axios";

const ONAIR_URL =
  process.env.NEXT_PUBLIC_ONAIR_API_HOST || "https://onair.sea.ncfritz.net";

const getStatus = async () => {
  try {
    const getStatusResponse = await axios.get(`${ONAIR_URL}/api/v1/status`, {
      validateStatus: (status) => {
        return status === 200;
      },
    });

    return getStatusResponse.data;
  } catch (e) {
    throw e;
  }
};

const getEvents = async () => {
  try {
    const getEventsResponse = await axios.get(`${ONAIR_URL}/api/v1/events`, {
      validateStatus: (status) => {
        return status === 200;
      },
    });

    return getEventsResponse;
  } catch (e) {
    throw e;
  }
};

const createOverride = async (data: any) => {
  try {
    const createOverrideResponse = await axios.put(
      `${ONAIR_URL}/api/v1/overrides`,
      data,
      {
        validateStatus: (status) => {
          return status === 200;
        },
      },
    );

    return createOverrideResponse;
  } catch (e) {
    throw e;
  }
};

const deleteOverride = async (overrideId: string) => {
  try {
    const deleteOverrideResponse = await axios.delete(
      `${ONAIR_URL}/api/v1/override/${overrideId}`,
      {
        validateStatus: (status) => {
          return status === 304 || status === 200;
        },
      },
    );

    return deleteOverrideResponse;
  } catch (e) {
    throw e;
  }
};

const setEventStatus = async (eventId: string, status: string) => {
  try {
    const updateEventResponse = await axios.put(
      `${ONAIR_URL}/api/v1/event/status`,
      { event_id: eventId, status: status },
      {
        validateStatus: (status) => {
          return status === 200;
        },
      },
    );

    return updateEventResponse;
  } catch (e) {
    throw e;
  }
};

const onairApi = {
  createOverride: createOverride,
  deleteOverride: deleteOverride,
  getEvents: getEvents,
  getStstus: getStatus,
  setEventStatus: setEventStatus,
};

export default onairApi;
