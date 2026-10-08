BEGIN;

-- NULL preserves existing single-chapter rows. Multi-chapter IDs are sorted UUIDs.
ALTER TABLE public.worksheets ADD COLUMN IF NOT EXISTS chapter_ids UUID[];
ALTER TABLE public.worksheets ADD COLUMN IF NOT EXISTS set_number INTEGER NOT NULL DEFAULT 1 CHECK (set_number BETWEEN 1 AND 3);
ALTER TABLE public.worksheets ADD COLUMN IF NOT EXISTS is_finalized BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.worksheets ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ;
ALTER TABLE public.worksheets DROP CONSTRAINT IF EXISTS worksheets_chapter_ids_check;
ALTER TABLE public.worksheets ADD CONSTRAINT worksheets_chapter_ids_check CHECK (
  chapter_ids IS NULL OR (
    cardinality(chapter_ids) BETWEEN 2 AND 50
    AND chapter_id = chapter_ids[1]
    AND array_position(chapter_ids, NULL) IS NULL
  )
);

DROP INDEX IF EXISTS public.idx_worksheets_unique_set;
CREATE UNIQUE INDEX idx_worksheets_unique_set
  ON public.worksheets(chapter_id, school_id, set_number)
  WHERE is_finalized = true AND chapter_ids IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_worksheets_multi_unique_set
  ON public.worksheets(school_id, chapter_ids, set_number)
  WHERE is_finalized = true AND chapter_ids IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_worksheets_multi_scope
  ON public.worksheets(school_id, chapter_ids) WHERE chapter_ids IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_worksheets_multi_active_set
  ON public.worksheets(school_id, chapter_ids, set_number)
  WHERE chapter_ids IS NOT NULL AND status <> 'failed';

NOTIFY pgrst, 'reload schema';
COMMIT;
