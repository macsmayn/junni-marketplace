-- Default-row i18n keys for capitalization_items and sources_uses_entries.
-- label_key: i18n key for rows created by the "add default row" buttons (render uses t(label_key) when set).
-- amount_auto: capitalization_items only; true while a default equity row's amount tracks the latest confirmed equity.
ALTER TABLE capitalization_items ADD COLUMN IF NOT EXISTS label_key text;
ALTER TABLE capitalization_items ADD COLUMN IF NOT EXISTS amount_auto boolean NOT NULL DEFAULT false;
ALTER TABLE sources_uses_entries ADD COLUMN IF NOT EXISTS label_key text;
