from abc import ABC


class Listener(ABC):
    def __init__(self, name):
        self.name = name

    def start(self):
        pass

    def stop(self):
        pass

    def get_name(self):
        return self.name
    
    def get_info(self):
        pass