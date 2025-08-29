import subprocess
from Models.Command import Command
from Models.Task import Task


class ShellCommand(Command):
    def __init__(self):
        self.name = "shell"

    def execute(self, task: Task) -> str:
        command = task.get_arguments().strip().split()
        return subprocess.getoutput(" ".join(command))