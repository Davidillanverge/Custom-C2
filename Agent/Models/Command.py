from abc import ABC, abstractmethod

from Models import Task


class Command(ABC):
    @abstractmethod
    def __init__(self):
        self.name = ""
        
    @abstractmethod
    def execute(self, task: Task):
        pass

    def get_name(self) -> str:
        return self.name