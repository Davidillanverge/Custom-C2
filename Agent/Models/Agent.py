import importlib
import pkgutil
from queue import Queue
import time
from typing import List

from Models import Commands
from Models.Command import Command
from Models.TaskResult import TaskResult
from Models.Task import Task
from Models.AgentMetadata import AgentMetadata


class Agent:
    def __init__(self, metadata):
        self.metadata : AgentMetadata = AgentMetadata(**metadata)
        self.tasks: Queue[Task] = Queue()
        self.results: Queue[TaskResult] = Queue()
        self.commands: List[Command] = self.initialize_all_commands()

    def initialize_all_commands(self):
        commands = []
        package = Commands
        for _, module_name, _ in pkgutil.iter_modules(package.__path__):
            module = importlib.import_module(f"Models.Commands.{module_name}")
            for attr in dir(module):
                obj = getattr(module, attr)
                # Verifica si es una clase y hereda de Command
                if isinstance(obj, type) and issubclass(obj, Command) and obj is not Command:
                    commands.append(obj())
        return commands

    def get_metadata(self) -> AgentMetadata:
        return self.metadata

    def add_task(self, task: Task):
        self.tasks.put(task)

    def get_task(self) -> Task:
        return self.tasks.get()

    def add_result(self, result: TaskResult):
        self.results.put(result)

    def get_results(self) -> List[TaskResult]:
        results = []
        while not self.results.empty():
            results.append(self.results.get())
        return results

    def get_command(self, name: str) -> Command | None:
        for command in self.commands:
            if command.get_name() == name:
                return command
        return None
    
    def execute_task(self, task: Task):
        # Simulate task execution
        command = self.get_command(task.command)
        if command:
            result_str = command.execute(task)
            result = TaskResult(task_id=task.id, result=result_str)
            self.add_result(result)
            print(f"Executed command {command.get_name()} for task {task.id}, result: {result_str}")
            return
        
        
    def Work(self):
        print("Executing tasks...")
        while True:
            if not self.tasks.empty():
                task = self.get_task()
                self.execute_task(task)
            time.sleep(1)