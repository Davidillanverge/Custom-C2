import json
import sqlite3
import threading
import datetime
from pathlib import Path

_DB_PATH = Path(__file__).parent.parent / 'c2.db'

_SCHEMA = """
CREATE TABLE IF NOT EXISTS agents (
    id          INTEGER PRIMARY KEY,
    hostname    TEXT NOT NULL DEFAULT '',
    username    TEXT NOT NULL DEFAULT '',
    processname TEXT NOT NULL DEFAULT '',
    pid         INTEGER NOT NULL DEFAULT 0,
    integrity   TEXT NOT NULL DEFAULT '',
    arch        TEXT NOT NULL DEFAULT '',
    lastseen    TEXT
);

CREATE TABLE IF NOT EXISTS pending_tasks (
    id         INTEGER PRIMARY KEY,
    agent_id   INTEGER NOT NULL,
    command    TEXT NOT NULL,
    arguments  TEXT NOT NULL DEFAULT '[]',
    file       TEXT NOT NULL DEFAULT '',
    file2      TEXT NOT NULL DEFAULT '',
    filename   TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS results (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id    INTEGER NOT NULL,
    agent_id   INTEGER NOT NULL,
    result     TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS builds (
    id          TEXT PRIMARY KEY,
    host        TEXT NOT NULL,
    port        INTEGER NOT NULL,
    arch        TEXT NOT NULL,
    sleep_ms    INTEGER NOT NULL,
    jitter_ms   INTEGER NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending',
    created_at  TEXT NOT NULL,
    finished_at TEXT,
    error_log   TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_pending_tasks_agent ON pending_tasks(agent_id);
CREATE INDEX IF NOT EXISTS idx_results_agent       ON results(agent_id);
"""

_MAX_RESULTS_PER_AGENT = 500


class Database:
    def __init__(self, path=None):
        self._path = str(path or _DB_PATH)
        self._lock = threading.Lock()
        self._init_schema()

    def _connect(self):
        conn = sqlite3.connect(self._path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("PRAGMA journal_mode = WAL")
        return conn

    def _init_schema(self):
        with self._lock, self._connect() as conn:
            conn.executescript(_SCHEMA)

    # ── Agents ────────────────────────────────────────────────────────────────

    def upsert_agent(self, agent_id, hostname, username, processname, pid, integrity, arch, lastseen=None):
        with self._lock, self._connect() as conn:
            conn.execute(
                """INSERT INTO agents (id, hostname, username, processname, pid, integrity, arch, lastseen)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT(id) DO UPDATE SET
                     hostname=excluded.hostname, username=excluded.username,
                     processname=excluded.processname, pid=excluded.pid,
                     integrity=excluded.integrity, arch=excluded.arch,
                     lastseen=excluded.lastseen""",
                (agent_id, hostname, username, processname, pid, integrity, arch, lastseen),
            )

    def update_agent_lastseen(self, agent_id, lastseen: str):
        with self._lock, self._connect() as conn:
            conn.execute("UPDATE agents SET lastseen=? WHERE id=?", (lastseen, agent_id))

    def load_agents(self):
        with self._lock, self._connect() as conn:
            return [dict(r) for r in conn.execute("SELECT * FROM agents")]

    def delete_agent(self, agent_id):
        with self._lock, self._connect() as conn:
            conn.execute("DELETE FROM agents WHERE id=?", (agent_id,))

    # ── Pending tasks ─────────────────────────────────────────────────────────

    def save_task(self, task_id, agent_id, command, arguments, file='', file2='', filename=''):
        created_at = datetime.datetime.utcnow().isoformat()
        with self._lock, self._connect() as conn:
            conn.execute(
                """INSERT OR REPLACE INTO pending_tasks
                   (id, agent_id, command, arguments, file, file2, filename, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (task_id, agent_id, command, json.dumps(arguments), file, file2, filename, created_at),
            )

    def delete_task(self, task_id):
        with self._lock, self._connect() as conn:
            conn.execute("DELETE FROM pending_tasks WHERE id=?", (task_id,))

    def load_tasks_for_agent(self, agent_id):
        with self._lock, self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM pending_tasks WHERE agent_id=? ORDER BY created_at",
                (agent_id,),
            ).fetchall()
            return [dict(r) for r in rows]

    # ── Results ───────────────────────────────────────────────────────────────

    def save_result(self, task_id, agent_id, result):
        created_at = datetime.datetime.utcnow().isoformat()
        with self._lock, self._connect() as conn:
            conn.execute(
                "INSERT INTO results (task_id, agent_id, result, created_at) VALUES (?, ?, ?, ?)",
                (task_id, agent_id, result, created_at),
            )
            # Keep only the latest MAX_RESULTS_PER_AGENT rows per agent
            conn.execute(
                """DELETE FROM results WHERE agent_id=? AND id NOT IN (
                     SELECT id FROM results WHERE agent_id=?
                     ORDER BY created_at DESC LIMIT ?
                   )""",
                (agent_id, agent_id, _MAX_RESULTS_PER_AGENT),
            )

    def load_results_for_agent(self, agent_id):
        with self._lock, self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM results WHERE agent_id=? ORDER BY created_at ASC",
                (agent_id,),
            ).fetchall()
            return [dict(r) for r in rows]

    # ── Builds ────────────────────────────────────────────────────────────────

    def save_build(self, build_id, host, port, arch, sleep_ms, jitter_ms, status, created_at,
                   finished_at=None, error_log=''):
        with self._lock, self._connect() as conn:
            conn.execute(
                """INSERT OR REPLACE INTO builds
                   (id, host, port, arch, sleep_ms, jitter_ms, status, created_at, finished_at, error_log)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (build_id, host, port, arch, sleep_ms, jitter_ms, status, created_at, finished_at, error_log),
            )

    def update_build(self, build_id, status, finished_at=None, error_log=''):
        with self._lock, self._connect() as conn:
            conn.execute(
                "UPDATE builds SET status=?, finished_at=?, error_log=? WHERE id=?",
                (status, finished_at, error_log, build_id),
            )

    def load_builds(self):
        with self._lock, self._connect() as conn:
            return [dict(r) for r in conn.execute("SELECT * FROM builds ORDER BY created_at DESC")]

    def delete_build(self, build_id):
        with self._lock, self._connect() as conn:
            conn.execute("DELETE FROM builds WHERE id=?", (build_id,))
