import os
from Models.Command import Command
from Models.Task import Task


class LsCommand(Command):
    def __init__(self):
        self.name = "ls"

    def execute(self, task: Task) -> str:
        arguments = task.get_arguments().strip().split()
        path = arguments[0] if arguments else "."
        return "\n".join(os.listdir(path))