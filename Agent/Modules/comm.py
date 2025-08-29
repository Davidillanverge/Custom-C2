from abc import ABC, abstractmethod
import time


class CommunicationModule(ABC):
    def __init__(self):
        self.running = False
        
    @abstractmethod
    def config(self):
        pass
    
    def start(self):
        self.checkin()
        time.sleep(5)

    @abstractmethod
    def stop(self):
        pass
    
    @abstractmethod
    def checkin(self):
        pass
    