import os

from Models.Command import Command
from Models.Task import Task


class CdCommand(Command):
    def __init__(self):
        self.name = "cd"

    def execute(self, task: Task) -> str:
        arguments = task.get_arguments().strip().split()
        os.chdir(arguments[0])
        return os.getcwd()