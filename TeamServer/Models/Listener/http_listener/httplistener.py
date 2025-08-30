import threading
from Models.Listener.http_listener.http_handler import HTTPRequestHandler
from Models.Listener.listener import Listener
from http.server import HTTPServer

# Implementación HTTP
class HTTPListener(Listener):
    def __init__(self, name, host='0.0.0.0', port=8080):
        super().__init__(name)
        self.host = host
        self.port = port
        self.server = None
        self.thread = None

    def start(self):
        self.server = HTTPServer((self.host, self.port), HTTPRequestHandler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        print(f"{self.name} HTTP listener started on {self.host}:{self.port}")

    def stop(self):
        if self.server:
            self.server.shutdown()
            self.thread.join()
            self.server.server_close()
            print(f"{self.name} HTTP listener stopped")

    def get_info(self):
        return {"type": "http", "name":self.name, "host":self.host, "port":self.port}
