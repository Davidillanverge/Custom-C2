import uuid
import datetime
from enum import Enum


class BuildStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED  = "failed"


class Build:
    def __init__(self, host: str, port: int, arch: str, sleep_ms: int = 5000, jitter_ms: int = 1000):
        self.id          = str(uuid.uuid4())
        self.host        = host
        self.port        = port
        self.arch        = arch
        self.sleep_ms    = sleep_ms
        self.jitter_ms   = jitter_ms
        self.status      = BuildStatus.PENDING
        self.created_at  = datetime.datetime.utcnow()
        self.finished_at = None
        self.error_log   = ""

    @classmethod
    def from_row(cls, row: dict) -> 'Build':
        b = cls.__new__(cls)
        b.id          = row['id']
        b.host        = row['host']
        b.port        = row['port']
        b.arch        = row['arch']
        b.sleep_ms    = row['sleep_ms']
        b.jitter_ms   = row['jitter_ms']
        b.status      = BuildStatus(row['status'])
        b.created_at  = datetime.datetime.fromisoformat(row['created_at'])
        b.finished_at = (datetime.datetime.fromisoformat(row['finished_at'])
                         if row.get('finished_at') else None)
        b.error_log   = row.get('error_log', '')
        return b

    def to_dict(self) -> dict:
        return {
            "id":          self.id,
            "host":        self.host,
            "port":        self.port,
            "arch":        self.arch,
            "sleep_ms":    self.sleep_ms,
            "jitter_ms":   self.jitter_ms,
            "status":      self.status.value,
            "created_at":  self.created_at.isoformat() + "Z",
            "finished_at": self.finished_at.isoformat() + "Z" if self.finished_at else None,
            "error_log":   self.error_log,
        }
