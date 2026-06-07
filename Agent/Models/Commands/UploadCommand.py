import base64
from Models.Command import Command
from Models.Task import Task


class UploadCommand(Command):
    def __init__(self):
        self.name = "upload"

    def execute(self, task: Task) -> str:
        arguments = task.get_arguments()
        if not arguments or not arguments[0]:
            return "Error: destination path required"
        file_data = task.get_file()
        if not file_data:
            return "Error: no file data"
        dest = arguments[0]
        try:
            data = base64.b64decode(file_data)
            with open(dest, 'wb') as f:
                f.write(data)
            return f"Uploaded {len(data)} bytes to {dest}"
        except Exception as e:
            return f"Error: {str(e)}"
