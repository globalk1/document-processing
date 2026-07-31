CREATE TABLE IF NOT EXISTS schema_metadata (
  `key` VARCHAR(191) PRIMARY KEY,
  value LONGTEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS schema_migrations (
  id VARCHAR(191) PRIMARY KEY,
  applied_at VARCHAR(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS grades (
  id VARCHAR(191) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  order_index INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  extra_json LONGTEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS units (
  id VARCHAR(191) PRIMARY KEY,
  grade_id VARCHAR(191) NOT NULL,
  parent_id VARCHAR(191) NULL,
  name VARCHAR(255) NOT NULL,
  order_index INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  extra_json LONGTEXT NOT NULL,
  CONSTRAINT fk_units_grade FOREIGN KEY (grade_id) REFERENCES grades(id) ON DELETE RESTRICT,
  CONSTRAINT fk_units_parent FOREIGN KEY (parent_id) REFERENCES units(id) ON DELETE SET NULL,
  INDEX idx_units_grade (grade_id, order_index)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS questions (
  id VARCHAR(191) PRIMARY KEY,
  grade_id VARCHAR(191) NOT NULL,
  unit_id VARCHAR(191) NOT NULL,
  type VARCHAR(32) NOT NULL,
  difficulty VARCHAR(16) NOT NULL DEFAULT 'A',
  prompt_md LONGTEXT NOT NULL,
  answer_md LONGTEXT NOT NULL,
  solution_md LONGTEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  visibility VARCHAR(32) NOT NULL DEFAULT 'public',
  created_by_auth_type VARCHAR(64) NOT NULL,
  created_by_key_name VARCHAR(191) NOT NULL,
  created_by_label VARCHAR(255) NOT NULL,
  created_at VARCHAR(40) NOT NULL,
  updated_at VARCHAR(40) NOT NULL,
  extra_json LONGTEXT NOT NULL,
  CONSTRAINT fk_questions_grade FOREIGN KEY (grade_id) REFERENCES grades(id) ON DELETE RESTRICT,
  CONSTRAINT fk_questions_unit FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE RESTRICT,
  INDEX idx_questions_filters (grade_id, unit_id, status, difficulty, updated_at),
  INDEX idx_questions_updated (updated_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS question_thinking (
  question_id VARCHAR(191) NOT NULL,
  position INT NOT NULL,
  content LONGTEXT NOT NULL,
  PRIMARY KEY (question_id, position),
  CONSTRAINT fk_question_thinking_question FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS question_options (
  row_id VARCHAR(191) PRIMARY KEY,
  question_id VARCHAR(191) NOT NULL,
  position INT NOT NULL,
  label VARCHAR(32) NOT NULL,
  content_md LONGTEXT NOT NULL,
  extra_json LONGTEXT NOT NULL,
  CONSTRAINT fk_question_options_question FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
  UNIQUE KEY uq_question_options_position (question_id, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS option_asset_links (
  option_row_id VARCHAR(191) NOT NULL,
  position INT NOT NULL,
  asset_id VARCHAR(191) NOT NULL,
  PRIMARY KEY (option_row_id, position),
  CONSTRAINT fk_option_assets_option FOREIGN KEY (option_row_id) REFERENCES question_options(row_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS question_assets (
  row_id VARCHAR(191) PRIMARY KEY,
  question_id VARCHAR(191) NOT NULL,
  position INT NOT NULL,
  asset_id VARCHAR(191) NOT NULL,
  role VARCHAR(64) NOT NULL,
  url LONGTEXT NOT NULL,
  storage_key LONGTEXT NOT NULL,
  alt_text LONGTEXT NOT NULL,
  mime_type VARCHAR(191) NOT NULL,
  source_language VARCHAR(64) NOT NULL,
  source_code LONGTEXT NOT NULL,
  marking_guide LONGTEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at VARCHAR(40) NOT NULL,
  extra_json LONGTEXT NOT NULL,
  CONSTRAINT fk_question_assets_question FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
  UNIQUE KEY uq_question_assets_position (question_id, position),
  UNIQUE KEY uq_question_assets_question_asset (question_id, asset_id),
  INDEX idx_assets_question (question_id, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS concepts (
  id VARCHAR(191) PRIMARY KEY,
  grade_id VARCHAR(191) NOT NULL,
  unit_id VARCHAR(191) NOT NULL,
  title VARCHAR(512) NOT NULL,
  summary_md LONGTEXT NOT NULL,
  status VARCHAR(32) NOT NULL,
  visibility VARCHAR(32) NOT NULL,
  created_by_auth_type VARCHAR(64) NOT NULL,
  created_by_key_name VARCHAR(191) NOT NULL,
  created_by_label VARCHAR(255) NOT NULL,
  created_at VARCHAR(40) NOT NULL,
  updated_at VARCHAR(40) NOT NULL,
  extra_json LONGTEXT NOT NULL,
  CONSTRAINT fk_concepts_grade FOREIGN KEY (grade_id) REFERENCES grades(id) ON DELETE RESTRICT,
  CONSTRAINT fk_concepts_unit FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE RESTRICT,
  INDEX idx_concepts_unit (grade_id, unit_id, status, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS concept_blocks (
  id VARCHAR(191) PRIMARY KEY,
  concept_id VARCHAR(191) NOT NULL,
  position INT NOT NULL,
  block_type VARCHAR(32) NOT NULL,
  title VARCHAR(512) NOT NULL,
  content_md LONGTEXT NOT NULL,
  extra_json LONGTEXT NOT NULL,
  CONSTRAINT fk_concept_blocks_concept FOREIGN KEY (concept_id) REFERENCES concepts(id) ON DELETE CASCADE,
  UNIQUE KEY uq_concept_blocks_position (concept_id, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS question_concepts (
  question_id VARCHAR(191) NOT NULL,
  concept_id VARCHAR(191) NOT NULL,
  relation_type VARCHAR(32) NOT NULL,
  position INT NOT NULL,
  PRIMARY KEY (question_id, concept_id),
  CONSTRAINT fk_question_concepts_question FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
  CONSTRAINT fk_question_concepts_concept FOREIGN KEY (concept_id) REFERENCES concepts(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS lecture_assets (
  id VARCHAR(191) PRIMARY KEY,
  role VARCHAR(64) NOT NULL,
  storage_key LONGTEXT NOT NULL,
  alt_text LONGTEXT NOT NULL,
  mime_type VARCHAR(191) NOT NULL,
  metadata_json LONGTEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS lecture_projects (
  id VARCHAR(191) PRIMARY KEY,
  title VARCHAR(512) NOT NULL,
  format VARCHAR(64) NOT NULL,
  schema_version INT NOT NULL,
  status VARCHAR(32) NOT NULL,
  current_revision_id VARCHAR(191) NULL,
  created_at VARCHAR(40) NOT NULL,
  updated_at VARCHAR(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS lecture_project_revisions (
  id VARCHAR(191) PRIMARY KEY,
  lecture_project_id VARCHAR(191) NOT NULL,
  revision_number INT NOT NULL,
  payload_json LONGTEXT NOT NULL,
  payload_sha256 VARCHAR(128) NOT NULL,
  created_at VARCHAR(40) NOT NULL,
  CONSTRAINT fk_lecture_revisions_project FOREIGN KEY (lecture_project_id) REFERENCES lecture_projects(id) ON DELETE RESTRICT,
  UNIQUE KEY uq_lecture_revision_number (lecture_project_id, revision_number),
  UNIQUE KEY uq_lecture_revision_hash (lecture_project_id, payload_sha256)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS lecture_concept_usages (
  revision_id VARCHAR(191) NOT NULL,
  placement_id VARCHAR(191) NOT NULL,
  concept_id VARCHAR(191) NOT NULL,
  section_id VARCHAR(191) NOT NULL,
  focus_id VARCHAR(191) NOT NULL,
  path LONGTEXT NOT NULL,
  PRIMARY KEY (revision_id, placement_id),
  CONSTRAINT fk_lecture_concept_usage_revision FOREIGN KEY (revision_id) REFERENCES lecture_project_revisions(id) ON DELETE CASCADE,
  CONSTRAINT fk_lecture_concept_usage_concept FOREIGN KEY (concept_id) REFERENCES concepts(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS lecture_question_usages (
  revision_id VARCHAR(191) NOT NULL,
  placement_id VARCHAR(191) NOT NULL,
  question_id VARCHAR(191) NOT NULL,
  slot_id VARCHAR(191) NOT NULL,
  section_id VARCHAR(191) NOT NULL,
  focus_id VARCHAR(191) NOT NULL,
  concept_id VARCHAR(191) NULL,
  demo_id VARCHAR(191) NOT NULL,
  path LONGTEXT NOT NULL,
  PRIMARY KEY (revision_id, placement_id),
  UNIQUE KEY uq_lecture_question_usage_slot (revision_id, slot_id),
  CONSTRAINT fk_lecture_question_usage_revision FOREIGN KEY (revision_id) REFERENCES lecture_project_revisions(id) ON DELETE CASCADE,
  CONSTRAINT fk_lecture_question_usage_question FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE RESTRICT,
  CONSTRAINT fk_lecture_question_usage_concept FOREIGN KEY (concept_id) REFERENCES concepts(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS lecture_asset_usages (
  revision_id VARCHAR(191) NOT NULL,
  placement_id VARCHAR(191) NOT NULL,
  asset_id VARCHAR(191) NOT NULL,
  role VARCHAR(64) NOT NULL,
  path LONGTEXT NOT NULL,
  PRIMARY KEY (revision_id, placement_id),
  CONSTRAINT fk_lecture_asset_usage_revision FOREIGN KEY (revision_id) REFERENCES lecture_project_revisions(id) ON DELETE CASCADE,
  CONSTRAINT fk_lecture_asset_usage_asset FOREIGN KEY (asset_id) REFERENCES lecture_assets(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
