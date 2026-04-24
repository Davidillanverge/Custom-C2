import threading
from Models.Agent.agent import Agent


def singleton(cls):
    instances = {}
    def get_instance(*args, **kwargs):
        if cls not in instances:
            instances[cls] = cls(*args, **kwargs)
        return instances[cls]
    return get_instance


@singleton
class AgentService:
    def __init__(self):
        self._agents: list[Agent] = []
        self._lock = threading.Lock()

    def add_agent(self, agent: Agent):
        with self._lock:
            self._agents.append(agent)

    def remove_agent(self, agent: Agent):
        with self._lock:
            self._agents.remove(agent)

    def get_agents(self) -> list[Agent]:
        with self._lock:
            return list(self._agents)

    def get_agent(self, id) -> Agent | None:
        with self._lock:
            for agent in self._agents:
                if agent.get_metadata().get_id() == id:
                    return agent
        return None
