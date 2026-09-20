import { SyncRunTrigger } from "../domain/syncRun";

/**
 * Signals "something may have changed" for a calendar — never does the
 * diff/upsert itself, that's entirely SyncEngine's job. Poll and push
 * implementations are interchangeable and can run side by side.
 */
export interface ChangeNotifier {
  start(onChange: (calendarId: string, trigger: SyncRunTrigger) => void): void;
  stop(): void;
}
