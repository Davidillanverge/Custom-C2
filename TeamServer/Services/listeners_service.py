from typing import List
from Models.Listener.listener import Listener

class ListenerService():
    def __init__(self):
        self._listeners: List[Listener] = []

    def get_listeners(self):
        return self._listeners

    def get_listener_by_name(self, name):
        """Devuelve un listener por Name"""
        for listener in self._listeners:
            if listener.get_name() == name:
                return listener
        return None

    def create_listener(self, listener: Listener):
        """Crea un nuevo listener"""
        self._listeners.append(listener)
        return listener

    def delete_listener(self, listener:Listener):
        """Elimina un listener"""
        self._listeners.remove(listener)
        return True
