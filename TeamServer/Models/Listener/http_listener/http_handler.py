import asyncio
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
        if self.path == "/":
            data = "Hello"
            self._send_response(data, status=200)

    def do_POST(self):
        if self.path == "/":
            # Leer Authorization Header
            auth_header = self.headers.get("Authorization")
            if not auth_header:
                self._send_response({"error": "Missing Authorization Header"}, status=401)
                return

            metadata_encoded = auth_header.split(" ")[1]
            metadata_json = base64.b64decode(metadata_encoded).decode("utf-8")
            agent_metadata : AgentMetadata = self.extractAgentMetadata(metadata_json)
            if agent_metadata is None:
                self._send_response({"error": "Invalid metadata"}, status=400)
                return
            
            agent =  self.agent_service.get_agent(agent_metadata.get_id())
            if agent == None:
                agent: Agent = Agent(metadata=agent_metadata)
                self.agent_service.add_agent(agent)
                self._send_response({"message": "Agent created successfully"}, status=201)
                return
            
            agent.check_in()
            
            # Leer Results
            content_length = int(self.headers.get("Content-Length", 0))
            if content_length > 0:
                body_bytes = self.rfile.read(content_length)
                body_str = body_bytes.decode("utf-8")
                print(body_str)
                agent.add_results(self.extractTaskResults(body_str))

            # Responde with tasks
            tasks = asyncio.run(agent.get_pendingTasks())
            self._send_response({"tasks": [task.to_dict() for task in tasks]}, status=200)



    def _send_response(self, data, status=200):
        """Helper para enviar JSON"""
        self.send_response(status)
        self.send_header("Content-type", "text/plain")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode("utf-8"))

    def extractAgentMetadata(self, metadata_str: str) -> AgentMetadata | None:
        try:
            agent_metadata: AgentMetadata = AgentMetadata(**json.loads(metadata_str))
        except:
            agent_metadata = None
        
        return agent_metadata
    
    def extractTaskResults(self, result_str: str):
        results_org = json.loads(result_str)
        results_toret : List[TaskResult] = []
        for result in results_org['results']:
            try:
                result : TaskResult = TaskResult(**result)
            except:
                result = None

            if result != None:
                results_toret.append(result)
                
        return results_toret