import base64
from http.server import BaseHTTPRequestHandler
import json
from typing import List

from Models.Agent.agent import Agent
from Models.Agent.agent_metadata import AgentMetadata
from Models.Agent.task_result import TaskResult
from Services.agent_service import AgentService


class HTTPRequestHandler(BaseHTTPRequestHandler):
    agent_service = AgentService()

    def do_GET(self):
        self._send_response({"error": "Not found"}, status=404)

    def do_POST(self):
        if self.path == "/":
            try:
                auth_header = self.headers.get("Authorization")
                if not auth_header:
                    self._send_response({"error": "Missing Authorization Header"}, status=401)
                    return

                metadata_encoded = auth_header.split(" ")[1]
                metadata_json = base64.b64decode(metadata_encoded).decode("utf-8")
                agent_metadata = self.extractAgentMetadata(metadata_json)
                if agent_metadata is None:
                    self._send_response({"error": "Invalid metadata"}, status=400)
                    return

                agent = self.agent_service.get_agent(agent_metadata.get_id())
                if agent is None:
                    agent = Agent(metadata=agent_metadata)
                    self.agent_service.add_agent(agent)
                    self._send_response({"message": "Agent created successfully"}, status=201)
                    return

                agent.check_in()

                content_length = int(self.headers.get("Content-Length", 0))
                if content_length > 0:
                    body_bytes = self.rfile.read(content_length)
                    body_str = body_bytes.decode("utf-8")
                    agent.add_results(self.extractTaskResults(body_str))

                tasks = agent.get_pending_tasks()
                self._send_response({"tasks": [task.to_dict() for task in tasks]}, status=200)
            except Exception as e:
                print(e)
                self._send_response({"error": "Internal Error"}, status=500)

    def _send_response(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode("utf-8"))

    def extractAgentMetadata(self, metadata_str: str) -> AgentMetadata | None:
        try:
            return AgentMetadata(**json.loads(metadata_str))
        except Exception:
            return None

    def extractTaskResults(self, result_str: str) -> List[TaskResult]:
        results_org = json.loads(result_str)
        results_decoded = base64.b64decode(results_org['results']).decode("utf-8", errors='replace')
        results_raw = json.loads(results_decoded)
        results = []
        for item in results_raw:
            try:
                results.append(TaskResult(**item))
            except Exception:
                pass
        return results

    def log_message(self, format, *args):
        pass
