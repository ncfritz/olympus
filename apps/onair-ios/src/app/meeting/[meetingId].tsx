import { useLocalSearchParams } from "expo-router";

import { Placeholder } from "../../components/Placeholder";

export default function MeetingScreen() {
  const { meetingId } = useLocalSearchParams<{ meetingId: string }>();
  return (
    <Placeholder
      title="Meeting status"
      description={`Follow the calendar, or set Do Not Disturb, Interruptable or Free for meeting ${meetingId}. Built in phase 2.`}
    />
  );
}
