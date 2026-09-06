-- Synthetic fixture for the SQL panel. Not real hardware, not real results.
-- Backends are deliberately named simulator_a..d so nobody reads a vendor
-- benchmark into an illustration.

CREATE TABLE experiment_runs (
  id       INTEGER PRIMARY KEY,
  circuit  TEXT NOT NULL,
  backend  TEXT NOT NULL,
  fidelity REAL,          -- nullable: a run can fail before it scores
  run_at   TEXT NOT NULL
);

INSERT INTO experiment_runs (circuit, backend, fidelity, run_at) VALUES
  ('ghz_8q', 'simulator_a', 0.988, '2026-08-14'),
  ('ghz_8q', 'simulator_a', 0.979, '2026-08-21'),
  ('ghz_8q', 'simulator_a', 0.979, '2026-08-29'),
  ('ghz_8q', 'simulator_b', 0.971, '2026-08-15'),
  ('ghz_8q', 'simulator_b', 0.962, '2026-08-22'),
  ('ghz_8q', 'simulator_b', 0.959, '2026-08-30'),
  ('ghz_8q', 'simulator_c', 0.949, '2026-08-16'),
  ('ghz_8q', 'simulator_c', 0.938, '2026-08-23'),
  ('ghz_8q', 'simulator_c', 0.936, '2026-08-31'),
  ('ghz_8q', 'simulator_d', 0.905, '2026-08-17'),
  ('ghz_8q', 'simulator_d', 0.899, '2026-08-24'),
  ('ghz_8q', 'simulator_d', NULL,  '2026-09-01'),   -- run recorded, never scored
  ('qft_6q', 'simulator_a', 0.955, '2026-08-18'),   -- different circuit, must be excluded
  ('qft_6q', 'simulator_b', 0.941, '2026-08-25');
