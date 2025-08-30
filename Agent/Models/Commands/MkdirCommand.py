import os

from Models.Command import Command
from Models.Task import Task


class MkdirCommand(Command):
    def __init__(self):
        self.name = "mkdir"

    def execute(self, task: Task) -> str:
        path = task.get_arguments().strip()
        try:
            os.makedirs(path, exist_ok=True)
            return f"Directory created: {path}"
        except Exception as e:
            return f"Error creating directory: {e}"
