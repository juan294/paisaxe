-- Add best_months column for seasonal story surfacing
-- Stores array of month numbers (1-12) when the story is best experienced
alter table stories add column if not exists best_months int[];

-- The existing metadata jsonb column stores additional feature data:
-- - question_prompts: string[] - contextual questions for the story
-- - mood_tags: string[] - mood categories (relajante, aventurero, cultural, delicioso)
-- - asturianu_title: string - title in Asturianu language
-- - asturianu_subtitle: string - subtitle in Asturianu language
comment on column stories.metadata is 'Extended metadata: question_prompts (string[]), mood_tags (string[]), asturianu_title (string), asturianu_subtitle (string)';
