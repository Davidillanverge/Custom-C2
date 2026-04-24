import os

from Models.Command import Command
from Models.Task import Task


class CdCommand(Command):
    def __init__(self):
        self.name = "cd"

    def execute(self, task: Task) -> str:
        arguments = task.get_arguments()
        path = arguments[0] if arguments else "."
        os.chdir(path)
        return os.getcwd()