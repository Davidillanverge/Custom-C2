import datetime
from queue import Queue
from typing import List
from Models.Agent.agent_metadata import AgentMetadata
from Models.Agent.task import Task
from Models.Agent.task_result import TaskResult


class Agent:
    def __init__(self, metadata: AgentMetadata):
        self.metadata = metadata
        self.lastseen = None
        self.tasks: Queue = Queue()
        self.results: List[TaskResult] = []

    def get_metadata(self) -> AgentMetadata:
        return self.metadata

    def set_metadata(self, metadata: AgentMetadata):
        self.metadata = metadata

    def get_lastseen(self):
        return self.lastseen

    def set_lastseen(self, lastseen):
        self.lastseen = lastseen

    def update_metadata(self, key: str, value: str):
        if key == "id":
            self.metadata.set_id(value)
        elif key == "hostname":
            self.metadata.set_hostname(value)
        elif key == "username":
            self.metadata.set_username(value)
        elif key == "processname":
            self.metadata.set_processname(value)
        elif key == "processid":
            self.metadata.set_pid(value)
        elif key == "integrity":
            self.metadata.set_integrity(value)
        elif key == "arch":
            self.metadata.set_arch(value)

    def check_in(self):
        self.set_lastseen(datetime.datetime.now())

    def check_out(self):
        self.set_lastseen(None)

    def get_tasks(self) -> List[Task]:
        return list(self.tasks.queue)

    def add_task(self, task: Task):
        self.tasks.put_nowait(task)

    def get_pending_tasks(self) -> List[Task]:
        tasks: List[Task] = []
        while not self.tasks.empty():
            tasks.append(self.tasks.get_nowait())
        return tasks

    def add_results(self, results: List[TaskResult]):
        for result in results:
            self.results.append(result)

    def get_results(self) -> List[TaskResult]:
        return self.results

    def get_result(self, task_id: int) -> TaskResult | None:
        for result in self.results:
            if result.get_task_id() == task_id:
                return result
        return None
