import datetime
import json
import threading

from Database.database import Database
from Models.Agent.agent import Agent
from Models.Agent.agent_metadata import AgentMetadata
from Models.Agent.task import Task
from Models.Agent.task_result import TaskResult


class AgentService:
    def __init__(self, db: Database):
        self._agents: list[Agent] = []
        self._lock = threading.Lock()
        self._db = db
        self._load_from_db()

    def _load_from_db(self):
        for row in self._db.load_agents():
            meta = AgentMetadata(
                id=row['id'],
                hostname=row['hostname'],
                username=row['username'],
                processname=row['processname'],
                pid=row['pid'],
                integrity=row['integrity'],
                arch=row['arch'],
            )
            agent = Agent(meta)
            agent.lastseen = row.get('lastseen')
            for t in self._db.load_tasks_for_agent(row['id']):
                task = Task(
                    id=t['id'],
                    command=t['command'],
                    arguments=json.loads(t['arguments']),
                    file=t.get('file', ''),
                    file2=t.get('file2', ''),
                    filename=t.get('filename', ''),
                )
                agent.tasks.put_nowait(task)
            for r in self._db.load_results_for_agent(row['id']):
                agent.results.append(TaskResult(
                    task_id=r['task_id'],
                    result=r['result'],
                    created_at=r.get('created_at'),
                ))
            self._agents.append(agent)

    def add_agent(self, agent: Agent):
        with self._lock:
            self._agents.append(agent)
        meta = agent.get_metadata()
        self._db.upsert_agent(
            meta.get_id(), meta.get_hostname(), meta.get_username(),
            meta.get_processname(), meta.get_pid(), meta.get_integrity(),
            meta.get_arch(), None,
        )

    def remove_agent(self, agent: Agent):
        with self._lock:
            self._agents.remove(agent)
        self._db.delete_agent(agent.get_metadata().get_id())

    def get_agents(self) -> list[Agent]:
        with self._lock:
            return list(self._agents)

    def get_agent(self, id) -> Agent | None:
        with self._lock:
            for agent in self._agents:
                if agent.get_metadata().get_id() == id:
                    return agent
        return None

    def add_task(self, agent: Agent, task: Task):
        agent.add_task(task)
        self._db.save_task(
            task.id, agent.get_metadata().get_id(),
            task.command, task.arguments,
            task.file or '', task.file2 or '', task.filename or '',
        )

    def pop_pending_tasks(self, agent: Agent) -> list[Task]:
        tasks = agent.get_pending_tasks()
        for t in tasks:
            self._db.delete_task(t.id)
        return tasks

    def record_results(self, agent: Agent, results: list[TaskResult]):
        agent.add_results(results)
        agent_id = agent.get_metadata().get_id()
        for r in results:
            self._db.save_result(r.task_id, agent_id, r.result)

    def checkin_agent(self, agent: Agent):
        agent.check_in()
        ls = agent.lastseen
        if isinstance(ls, datetime.datetime):
            ls = ls.isoformat()
        self._db.update_agent_lastseen(agent.get_metadata().get_id(), ls)
