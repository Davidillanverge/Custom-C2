import psutil
from Models.Command import Command
from Models.Task import Task


class PsCommand(Command):
    def __init__(self):
        self.name = "ps"
        
    def execute(self, task: Task) -> str:
        procs = []
        for proc in psutil.process_iter(['pid', 'name', 'username']):
            try:
                info = proc.info
                procs.append(f"{info['pid']} {info['username']} {info['name']}")
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
        return "\n".join(procs)