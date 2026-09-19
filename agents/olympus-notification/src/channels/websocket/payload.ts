/** What the browser receives: a plain title/message or the raw context. */
export interface WebSocketPayload {
  type: "plain" | "context";
  value: string | Record<never, never>;
}
