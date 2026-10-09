-- The color a user shows a synced calendar in (calendar users plan phase
-- 7). The console kept these per viewer at the sync agent; the site keeps
-- them per user here. Keyed by the calendar's source label, which is
-- unique at the agent and is how meetings name their calendar.
CREATE TABLE minerva.calendar_colors (
    user_id uuid NOT NULL,
    source text NOT NULL,
    color text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT calendar_colors_source_check CHECK (length(source) BETWEEN 1 AND 64),
    CONSTRAINT calendar_colors_color_check CHECK (color ~ '^#[0-9a-f]{6}$')
);

ALTER TABLE ONLY minerva.calendar_colors
    ADD CONSTRAINT calendar_colors_pkey PRIMARY KEY (user_id, source);
ALTER TABLE ONLY minerva.calendar_colors
    ADD CONSTRAINT calendar_colors_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES olympus.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

CREATE TRIGGER set_minerva_calendar_colors_updated_at BEFORE UPDATE ON minerva.calendar_colors
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();
