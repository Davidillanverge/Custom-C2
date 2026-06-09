import datetime
import logging
import shutil
import threading
from pathlib import Path

from Database.database import Database
from Models.Build.build import Build, BuildStatus


_THIS_DIR   = Path(__file__).parent
_SERVER_DIR = _THIS_DIR.parent
_REPO_ROOT  = _SERVER_DIR.parent

BUILDS_DIR = _SERVER_DIR / "builds"
DIST_DIR   = _REPO_ROOT / "AgentWindows" / "dist"

_HOST_MAGIC        = b'\xDE\xAD\xBE\xEF\xC2\xC2\xC2\xC2'
_PORT_MAGIC        = b'\xDE\xAD\xBE\xEF\xC2\xC2\xC2\xC3'
_SLEEP_MAGIC       = b'\xDE\xAD\xBE\xEF\xC2\xC2\xC2\xC4'
_JITTER_MAGIC      = b'\xDE\xAD\xBE\xEF\xC2\xC2\xC2\xC5'
_HOST_FIELD_SIZE   = 64
_PORT_FIELD_SIZE   = 8
_SLEEP_FIELD_SIZE  = 8
_JITTER_FIELD_SIZE = 8

_ARCH_DLL: dict[str, Path] = {
    "x64":   DIST_DIR / "agent_x64.dll",
    "x86":   DIST_DIR / "agent_x86.dll",
    "ARM64": DIST_DIR / "agent_ARM64.dll",
}


class BuilderService:
    def __init__(self, db: Database):
        self._builds: dict[str, Build] = {}
        self._lock = threading.Lock()
        self._db = db
        BUILDS_DIR.mkdir(parents=True, exist_ok=True)
        DIST_DIR.mkdir(parents=True, exist_ok=True)
        self._load_from_db()

    def _load_from_db(self):
        for row in self._db.load_builds():
            build = Build.from_row(row)
            self._builds[build.id] = build

    # ------------------------------------------------------------------ public

    def check(self) -> dict:
        archs = {arch: path.exists() for arch, path in _ARCH_DLL.items()}
        return {"available": any(archs.values()), "archs": archs}

    def create_build(self, host: str, port: int, arch: str, sleep_ms: int = 5000, jitter_ms: int = 1000) -> Build:
        build = Build(host, port, arch, sleep_ms, jitter_ms)
        with self._lock:
            self._builds[build.id] = build
        self._db.save_build(
            build.id, build.host, build.port, build.arch,
            build.sleep_ms, build.jitter_ms,
            build.status.value, build.created_at.isoformat(),
        )
        threading.Thread(target=self._patch_build, args=(build,), daemon=True).start()
        return build

    def get_build(self, build_id: str) -> Build | None:
        with self._lock:
            return self._builds.get(build_id)

    def get_all_builds(self) -> list[Build]:
        with self._lock:
            return list(self._builds.values())

    def artifact_path(self, build_id: str) -> Path | None:
        p = BUILDS_DIR / build_id / "agent_patched.dll"
        return p if p.exists() else None

    def delete_build(self, build_id: str) -> bool:
        build_dir = BUILDS_DIR / build_id
        if build_dir.exists():
            shutil.rmtree(build_dir, ignore_errors=True)
        with self._lock:
            removed = self._builds.pop(build_id, None) is not None
        if removed:
            self._db.delete_build(build_id)
        return removed

    # ----------------------------------------------------------------- private

    def _patch_build(self, build: Build):
        try:
            base_dll = _ARCH_DLL.get(build.arch)
            if not base_dll or not base_dll.exists():
                raise FileNotFoundError(
                    f"Base DLL for {build.arch} not found.\n"
                    f"Compile the agent on Windows (Visual Studio, Release/{build.arch}) "
                    f"and place the output DLL at:\n"
                    f"  AgentWindows/dist/agent_{build.arch.lower()}.dll"
                )

            patched = _patch_dll(base_dll.read_bytes(), build.host, build.port, build.sleep_ms, build.jitter_ms)

            out_dir = BUILDS_DIR / build.id
            out_dir.mkdir(parents=True, exist_ok=True)
            (out_dir / "agent_patched.dll").write_bytes(patched)

            with self._lock:
                build.status      = BuildStatus.SUCCESS
                build.finished_at = datetime.datetime.utcnow()
            self._db.update_build(build.id, BuildStatus.SUCCESS.value, build.finished_at.isoformat())

        except Exception as e:
            logging.error("Build %s failed: %s", build.id, e)
            with self._lock:
                build.status      = BuildStatus.FAILED
                build.finished_at = datetime.datetime.utcnow()
                build.error_log   = str(e)
            self._db.update_build(
                build.id, BuildStatus.FAILED.value,
                build.finished_at.isoformat(), str(e),
            )


def _patch_field(buf: bytearray, magic: bytes, value_bytes: bytes, field_size: int, field_name: str) -> None:
    idx = bytes(buf).find(magic)
    if idx == -1:
        raise ValueError(
            f"{field_name} magic marker not found in DLL. "
            "Make sure the DLL was compiled with AgentConfig.cpp included in the project."
        )
    start = idx + len(magic)
    buf[start:start + field_size] = value_bytes + b'\x00' * (field_size - len(value_bytes))


def _patch_dll(data: bytes, host: str, port: int, sleep_ms: int = 5000, jitter_ms: int = 1000) -> bytes:
    buf = bytearray(data)

    host_bytes = host.encode('ascii')
    if len(host_bytes) > _HOST_FIELD_SIZE - 1:
        raise ValueError(f"Host too long (max {_HOST_FIELD_SIZE - 1} characters)")

    port_bytes = str(port).encode('ascii')
    if len(port_bytes) > _PORT_FIELD_SIZE - 1:
        raise ValueError(f"Port value out of range (max {_PORT_FIELD_SIZE - 1} digits)")

    sleep_bytes = str(sleep_ms).encode('ascii')
    if len(sleep_bytes) > _SLEEP_FIELD_SIZE - 1:
        raise ValueError(f"Sleep value too large (max {_SLEEP_FIELD_SIZE - 1} digits)")

    jitter_bytes = str(jitter_ms).encode('ascii')
    if len(jitter_bytes) > _JITTER_FIELD_SIZE - 1:
        raise ValueError(f"Jitter value too large (max {_JITTER_FIELD_SIZE - 1} digits)")

    _patch_field(buf, _HOST_MAGIC,   host_bytes,   _HOST_FIELD_SIZE,   "Host")
    _patch_field(buf, _PORT_MAGIC,   port_bytes,   _PORT_FIELD_SIZE,   "Port")
    _patch_field(buf, _SLEEP_MAGIC,  sleep_bytes,  _SLEEP_FIELD_SIZE,  "Sleep")
    _patch_field(buf, _JITTER_MAGIC, jitter_bytes, _JITTER_FIELD_SIZE, "Jitter")

    return bytes(buf)
