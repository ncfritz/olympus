-- A note's owner is its user_id (ADR 0028, calendar users plan phase 1);
-- the free-text author it carried before users is dropped (phase 8). The
-- API stopped reading it then and stops writing it now.
ALTER TABLE minerva.notes DROP COLUMN author;
