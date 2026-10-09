-- A calendar's source names its events, which Olympus keys by across
-- every user's calendars (ADR 0028): no two calendars may share one.
-- CreateIndex
CREATE UNIQUE INDEX "SyncedCalendar_source_key" ON "SyncedCalendar"("source");
