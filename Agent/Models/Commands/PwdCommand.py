import os

from Models.Command import Command
from Models.Task import Task


class PwdCommand(Command):
    def __init__(self):
        self.name = "pwd"

    def execute(self, task: Task) -> str:
        return os.getcwd()