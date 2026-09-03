CREATE TABLE IF NOT EXISTS muja_documents (
  collection_name TEXT NOT NULL,
  document_id TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  version BIGINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (collection_name, document_id)
);

CREATE INDEX IF NOT EXISTS muja_documents_collection_idx
  ON muja_documents (collection_name);

CREATE INDEX IF NOT EXISTS muja_documents_data_gin_idx
  ON muja_documents USING GIN (data);
