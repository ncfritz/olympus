import axios from "axios";
import { required } from "../utils/settings";

const ONAIR_URL = required(
  "NEXT_PUBLIC_ONAIR_API_HOST",
  process.env.NEXT_PUBLIC_ONAIR_API_HOST,
);

const getStatus = async () => {
  const getStatusResponse = await axios.get(`${ONAIR_URL}/api/v1/status`, {
    validateStatus: (status) => {
      return status === 200;
    },
  });

  return getStatusResponse.data;
};

const getEvents = async () => {
  const getEventsResponse = await axios.get(`${ONAIR_URL}/api/v1/events`, {
    validateStatus: (status) => {
      return status === 200;
    },
  });

  return getEventsResponse;
};

const createOverride = async (data: any) => {
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
};

const deleteOverride = async (overrideId: string) => {
  const deleteOverrideResponse = await axios.delete(
    `${ONAIR_URL}/api/v1/override/${overrideId}`,
    {
      validateStatus: (status) => {
        return status === 304 || status === 200;
      },
    },
  );

  return deleteOverrideResponse;
};

const setEventStatus = async (eventId: string, status: string) => {
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
};

const onairApi = {
  createOverride: createOverride,
  deleteOverride: deleteOverride,
  getEvents: getEvents,
  getStstus: getStatus,
  setEventStatus: setEventStatus,
};

export default onairApi;
