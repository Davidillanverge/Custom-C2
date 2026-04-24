from typing import List
from Models.Listener.listener import Listener


def singleton(cls):
    instances = {}
    def get_instance(*args, **kwargs):
        if cls not in instances:
            instances[cls] = cls(*args, **kwargs)
        return instances[cls]
    return get_instance


@singleton
class ListenerService:
    def __init__(self):
        self._listeners: List[Listener] = []

    def get_listeners(self) -> List[Listener]:
        return list(self._listeners)

    def get_listener_by_name(self, name: str) -> Listener | None:
        for listener in self._listeners:
            if listener.get_name() == name:
                return listener
        return None

    def create_listener(self, listener: Listener) -> Listener:
        self._listeners.append(listener)
        return listener

    def delete_listener(self, listener: Listener) -> bool:
        self._listeners.remove(listener)
        return True
