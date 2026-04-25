import datetime
import shutil
import threading
from pathlib import Path

from Models.Build.build import Build, BuildStatus


def singleton(cls):
    instances = {}
    def get_instance(*args, **kwargs):
        if cls not in instances:
            instances[cls] = cls(*args, **kwargs)
        return instances[cls]
    return get_instance


_THIS_DIR   = Path(__file__).parent
_SERVER_DIR = _THIS_DIR.parent
_REPO_ROOT  = _SERVER_DIR.parent

BUILDS_DIR = _SERVER_DIR / "builds"
DIST_DIR   = _REPO_ROOT / "AgentWindows" / "dist"

# Magic markers embedded in the compiled DLL by AgentConfig.cpp.
# Must match the byte literals in AgentConfig.cpp exactly.
_HOST_MAGIC      = b'\xDE\xAD\xBE\xEF\xC2\xC2\xC2\xC2'
_PORT_MAGIC      = b'\xDE\xAD\xBE\xEF\xC2\xC2\xC2\xC3'
_HOST_FIELD_SIZE = 64   # bytes reserved after the magic (max 63-char string + null)
_PORT_FIELD_SIZE = 8    # bytes reserved after the magic (max 5-digit port + null)

# Pre-compiled base DLLs, one per architecture, placed in AgentWindows/dist/
_ARCH_DLL: dict[str, Path] = {
    "x64":   DIST_DIR / "agent_x64.dll",
    "x86":   DIST_DIR / "agent_x86.dll",
    "ARM64": DIST_DIR / "agent_ARM64.dll",
}


@singleton
class BuilderService:
    def __init__(self):
        self._builds: dict[str, Build] = {}
        self._lock = threading.Lock()
        BUILDS_DIR.mkdir(parents=True, exist_ok=True)
        DIST_DIR.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------ public

    def check(self) -> dict:
        archs = {arch: path.exists() for arch, path in _ARCH_DLL.items()}
        return {
            "available": any(archs.values()),
            "archs": archs,
        }

    def create_build(self, host: str, port: int, arch: str) -> Build:
        build = Build(host, port, arch)
        with self._lock:
            self._builds[build.id] = build
        # Patching is instant — run synchronously, no background thread needed
        self._patch_build(build)
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
            return self._builds.pop(build_id, None) is not None

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

            patched = _patch_dll(base_dll.read_bytes(), build.host, build.port)

            out_dir = BUILDS_DIR / build.id
            out_dir.mkdir(parents=True, exist_ok=True)
            (out_dir / "agent_patched.dll").write_bytes(patched)

            with self._lock:
                build.status      = BuildStatus.SUCCESS
                build.finished_at = datetime.datetime.utcnow()

        except Exception as e:
            with self._lock:
                build.status      = BuildStatus.FAILED
                build.finished_at = datetime.datetime.utcnow()
                build.error_log   = str(e)


def _patch_dll(data: bytes, host: str, port: int) -> bytes:
    buf = bytearray(data)

    host_bytes = host.encode('ascii')
    if len(host_bytes) > _HOST_FIELD_SIZE - 1:
        raise ValueError(f"Host too long (max {_HOST_FIELD_SIZE - 1} characters)")

    port_bytes = str(port).encode('ascii')
    if len(port_bytes) > _PORT_FIELD_SIZE - 1:
        raise ValueError(f"Port value out of range (max {_PORT_FIELD_SIZE - 1} digits)")

    # Patch host
    idx = bytes(buf).find(_HOST_MAGIC)
    if idx == -1:
        raise ValueError(
            "Host magic marker not found in DLL. "
            "Make sure the DLL was compiled with AgentConfig.cpp included in the project."
        )
    start = idx + len(_HOST_MAGIC)
    buf[start:start + _HOST_FIELD_SIZE] = (
        host_bytes + b'\x00' * (_HOST_FIELD_SIZE - len(host_bytes))
    )

    # Patch port
    idx = bytes(buf).find(_PORT_MAGIC)
    if idx == -1:
        raise ValueError(
            "Port magic marker not found in DLL. "
            "Make sure the DLL was compiled with AgentConfig.cpp included in the project."
        )
    start = idx + len(_PORT_MAGIC)
    buf[start:start + _PORT_FIELD_SIZE] = (
        port_bytes + b'\x00' * (_PORT_FIELD_SIZE - len(port_bytes))
    )

    return bytes(buf)
