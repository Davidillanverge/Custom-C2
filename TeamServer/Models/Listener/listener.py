from abc import ABC, abstractmethod

from Services.agent_service import AgentService

class Listener(ABC):
    def __init__(self, name):
        self.name = name
        self.agent_service = AgentService()

    def start(self):
        pass

    def stop(self):
        pass

    def get_name(self):
        return self.name
    
    def get_info(self):
        pass