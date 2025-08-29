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

    
    _agents: list[Agent] = []


    def add_agent(self, agent: Agent):
        self._agents.append(agent)

    def remove_agent(self, agent: Agent):
        self._agents.remove(agent)

    def get_agents(self) -> list[Agent]:
        return self._agents
    
    def get_agent(self, id):
        for agent in self._agents:
            if agent.get_metadata().get_id() == id:
                return agent
        return None
    
