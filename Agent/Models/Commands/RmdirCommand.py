import os
from Models.Command import Command
from Models.Task import Task


class RmdirCommand(Command):
    def __init__(self):
        self.name = "rmdir"

    def execute(self, task: Task) -> str:
        path = task.get_arguments().strip()
        try:
            os.rmdir(path)
            return f"Directory removed: {path}"
        except Exception as e:
            return f"Error removing directory: {e}"
