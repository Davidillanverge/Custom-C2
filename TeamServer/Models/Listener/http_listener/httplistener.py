import threading
from http.server import ThreadingHTTPServer
from Models.Listener.http_listener.http_handler import make_handler
from Models.Listener.listener import Listener


class HTTPListener(Listener):
    def __init__(self, name, host='0.0.0.0', port=8080, agent_service=None):
        super().__init__(name)
        self.host = host
        self.port = port
        self.agent_service = agent_service
        self.server = None
        self.thread = None

    def start(self):
        handler_cls = make_handler(self.agent_service)
        self.server = ThreadingHTTPServer((self.host, self.port), handler_cls)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def stop(self):
        if self.server:
            self.server.shutdown()
            self.thread.join()
            self.server.server_close()

    def get_info(self):
        return {"type": "http", "name": self.name, "host": self.host, "port": self.port}
