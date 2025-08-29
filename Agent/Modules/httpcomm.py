import base64
import json
import time
import requests
from Models.Task import Task
from Models.Agent import Agent
from Modules.comm import CommunicationModule

class HTTPCommunicationModule(CommunicationModule):
    def __init__(self, address, port):
        super().__init__()
        self.address = address
        self.port = port
        self.headers = {}
        self.agent : Agent = None

    def config(self, agent: Agent):
        """
        Config Headers
        """
        self.headers = {"Content-Type": "application/json",
                        "Authorization": f"Bearer {base64.b64encode(json.dumps(agent.get_metadata().to_dict()).encode('utf-8')).decode('utf-8')}"
                        }
        self.agent = agent
        self.running = True

    def start(self):
        while self.running:
            self.checkin()
            time.sleep(5)

    def stop(self):
        self.running = False

    def checkin(self) -> str | None:
        results = [result.to_dict() for result in self.agent.get_results()]
        response = requests.post(f"http://{self.address}:{self.port}/", headers=self.headers, data=json.dumps({"results": results}))
        print(response.text)
        if response.status_code == 200 or response.status_code == 201:
            data = response.json()
            if "tasks" in data:
                for task in data["tasks"]:
                    task = Task(**task)
                    self.agent.add_task(task)
                print(data['tasks'])
        return None

