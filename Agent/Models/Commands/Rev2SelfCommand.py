import ctypes
import platform
from Models.Command import Command
from Models.Task import Task


class Rev2SelfCommand(Command):
    def __init__(self):
        self.name = "rev2self"

    def execute(self, task: Task) -> str:
        if platform.system() != "Windows":
            return "Error: rev2self is only supported on Windows"

        ok = ctypes.windll.advapi32.RevertToSelf()
        if not ok:
            return f"Error: RevertToSelf failed (code {ctypes.GetLastError()})"

        return "Reverted to original security context"
