/** A Synology Chat webhook message. */
export interface SynoChatPayload {
  text: string;
  file_url?: string;
  user_ids?: number[];
}
