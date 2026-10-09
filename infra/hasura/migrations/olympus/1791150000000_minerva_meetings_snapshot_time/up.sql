-- When the calendar sync agent took the snapshot a meeting was last
-- written from (ADR 0028, amended). The API writes a meeting from an event
-- only when its snapshot is not older than this, so a message that comes
-- back late from a retry, or a redrive, cannot undo a newer one. Null for
-- meetings written before, and for those not from the agent.
ALTER TABLE minerva.meetings ADD COLUMN snapshot_time timestamptz;

COMMENT ON COLUMN minerva.meetings.snapshot_time IS
    'When the calendar sync agent took the snapshot this meeting was last written from; a write from an older one is skipped';
