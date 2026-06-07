import uuid
import datetime
from enum import Enum


class BuildStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED  = "failed"


class Build:
    def __init__(self, host: str, port: int, arch: str):
        self.id          = str(uuid.uuid4())
        self.host        = host
        self.port        = port
        self.arch        = arch
        self.status      = BuildStatus.PENDING
        self.created_at  = datetime.datetime.utcnow()
        self.finished_at = None
        self.error_log   = ""

    def to_dict(self) -> dict:
        return {
            "id":          self.id,
            "host":        self.host,
            "port":        self.port,
            "arch":        self.arch,
            "status":      self.status.value,
            "created_at":  self.created_at.isoformat() + "Z",
            "finished_at": self.finished_at.isoformat() + "Z" if self.finished_at else None,
            "error_log":   self.error_log,
        }
