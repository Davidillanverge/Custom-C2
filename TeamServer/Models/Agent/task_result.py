import datetime


class TaskResult:
    def __init__(self, task_id: int, result: str, agent_id: int = None, created_at: str = None):
        self.task_id = task_id
        self.result = result
        self.agent_id = agent_id
        self.created_at = created_at or datetime.datetime.utcnow().isoformat()

    def get_task_id(self):
        return self.task_id

    def get_result(self):
        return self.result

    def to_dict(self):
        return {
            "task_id": self.task_id,
            "result": self.result,
            "created_at": self.created_at,
        }
