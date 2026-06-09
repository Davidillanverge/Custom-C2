import threading
from typing import List
from Models.Listener.listener import Listener


class ListenerService:
    def __init__(self):
        self._listeners: List[Listener] = []
        self._lock = threading.Lock()

    def get_listeners(self) -> List[Listener]:
        with self._lock:
            return list(self._listeners)

    def get_listener_by_name(self, name: str) -> Listener | None:
        with self._lock:
            for listener in self._listeners:
                if listener.get_name() == name:
                    return listener
        return None

    def create_listener(self, listener: Listener) -> Listener:
        with self._lock:
            self._listeners.append(listener)
        return listener

    def delete_listener(self, listener: Listener) -> bool:
        with self._lock:
            self._listeners.remove(listener)
        return True
