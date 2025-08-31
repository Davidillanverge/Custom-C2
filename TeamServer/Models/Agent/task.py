from typing import List


class Task:
    def __init__(self, id, command, arguments: List[str], file: bytes = None):
        self.id = id
        self.command = command
        self.arguments = arguments
        self.file = file

    def get_id(self):
        return self.id

    def get_command(self):
        return self.command

    def set_command(self, value):
        self.command = value

    def get_arguments(self):
        return self.arguments

    def set_arguments(self, value: List[str]):
        self.arguments = value

    def get_file(self):
        return self.file

    def set_file(self, value):
        self.file = value

    def to_dict(self):
        return {
            "id": self.id,
            "command": self.command,
            "arguments": self.arguments,
            "file": self.file,
        }