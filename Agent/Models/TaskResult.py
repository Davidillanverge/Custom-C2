class TaskResult:
    def __init__(self, task_id: int, result: str):
        self.task_id = task_id
        self.result = result

    def get_task_id(self):
        return self.task_id

    def get_result(self):
        return self.result
    
    def set_result(self, result: str):
        self.result = result

    def to_dict(self):
        return {
            "task_id": self.task_id,
            "result": self.result
        }