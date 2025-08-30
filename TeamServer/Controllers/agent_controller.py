import asyncio
import random
from flask import Blueprint, request
from flask import current_app as app
from Models.Agent.agent import Agent
from Models.Agent.agent_metadata import AgentMetadata
from Models.Agent.task import Task
from Services.agent_service import AgentService


agent_service : AgentService = AgentService()

agent_bp = Blueprint('agents', __name__)

@agent_bp.route('/', methods=['GET'])
def get_agents():
    """
    Obtener todos los Agentes
    ---
    tags:
      - Agent
    responses:
      200:
        description: Lista de Agentes
        examples:
          application/json: [{"id": 1,"hostname": "victim1", "username": "test", "processname", "rundll32.exe", "pid": 7372, "integryty": "High", "arch": "x64"},{"id": 2,"hostname": "victim2", "username": "test2", "processname", "rundll32.exe", "pid": 72422, "integryty": "High", "arch": "x64"}]
    """
    agents = agent_service.get_agents()
    return {'agents': [agent.get_metadata().to_dict() for agent in agents]}

@agent_bp.route('/<int:agent_id>', methods=['GET'])
def get_agent(agent_id):
    """
    Obtener un Agente por ID
    ---
    tags:
      - Agent
    parameters:
      - name: agent_id
        in: path
        required: true
        type: integer
        description: ID del Agente
    responses:
      200:
        description: Detalles del Agente
      404:
        description: Agente no encontrado
    """
    agent = agent_service.get_agent(agent_id)
    if agent:
        return agent.get_metadata().to_dict()
    return {'error': 'Agent not found'}, 404

@agent_bp.route('/<int:agent_id>/checkin', methods=['POST'])
def checkin_agent(agent_id):
    agent = agent_service.get_agent(agent_id)
    if agent:
        agent.check_in()
        return {'message': 'Agent checked in successfully'}
    return {'error': 'Agent not found'}, 404

@agent_bp.route('/<int:agent_id>/checkout', methods=['POST'])
def checkout_agent(agent_id):
    agent = agent_service.get_agent(agent_id)
    if agent:
        agent.check_out()
        return {'message': 'Agent checked out successfully'}
    return {'error': 'Agent not found'}, 404

@agent_bp.route('/<int:agent_id>', methods=['DELETE'])
def delete_agent(agent_id):
    """
    Eliminar un Agente por ID
    ---
    tags:
      - Agent
    parameters:
      - name: agent_id
        in: path
        required: true
        type: integer
        description: ID del Agente
    responses:
      200:
        description: Agente eliminado con éxito
      404:
        description: Agente no encontrado
    """
    agent = agent_service.get_agent(agent_id)
    if agent:
        agent_service.remove_agent(agent)
        return {'message': 'Agent deleted successfully'}
    return {'error': 'Agent not found'}, 404

@agent_bp.route('/', methods=['POST'])
def create_agent():
    """Crear un nuevo Agente
    ---
    tags:
      - Agent
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            id:
              type: integer
              required: true
              example: 1
            hostname:
              type: string
              required: true
              example: "victim1"
            username:
              type: string
              required: true
              example: "test" 
            processname:
              type: string
              required: true
              example: "rundll32.exe"
            pid:
              type: int
              required: true
              example: 7372
            integrity:
              type: string
              required: true
              example: "High"
            arch:
              type: string
              required: true
              example: "x64"
          required: true

    responses:
      200:
        description: Agente INFO
        examples:
          application/json: [{"id": 1,"hostname": "victim1", "username": "test", "processname": "rundll32.exe", "pid": 7372, "integrity": "High", "arch": "x64"}]
    """
    agent_data = request.json
    agent_metadata :AgentMetadata = AgentMetadata(
        id=agent_data.get("id"),
        hostname=agent_data.get("hostname"),
        username=agent_data.get("username"),
        processname=agent_data.get("processname"),
        pid=agent_data.get("pid"),
        integrity=agent_data.get("integrity"),
        arch=agent_data.get("arch")
    )

    agent = agent_service.get_agent(agent_metadata.get_id())
    if agent != None:
        return {'error': 'Agent already exists'}, 400
    agent = Agent(agent_metadata)
    agent_service.add_agent(agent)
    return {'agent': agent.get_metadata().to_dict()}, 201

@agent_bp.route('/<int:agent_id>/task', methods=['POST'])
def add_task(agent_id):
    """Añadir una tarea a un Agente
    ---
    tags:
      - Agent
    parameters:
      - name: agent_id
        in: path
        required: true
        type: integer
        description: ID del Agente
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            command:
              type: string
              required: true
              example: "whoami"
            arguments:
              type: string
              required: true
              example: "/all" 
            file:
              type: string
              required: true
              example: "base64"
    responses:
      200:
        description: Agente INFO
        examples:
          application/json: [{"id": 1,"hostname": "victim1", "username": "test", "processname": "rundll32.exe", "pid": 7372, "integrity": "High", "arch": "x64"}]
    """
    agent = agent_service.get_agent(agent_id)
    if agent:
        task_data = request.json
        task = Task(
            id=random.randint(1000, 9999),  # Generar un ID aleatorio para la tarea
            command=task_data.get("command"),
            arguments=task_data.get("arguments"),
            file=task_data.get("file")
        )
        agent.add_task(task)
        return {'message': 'Task added successfully'}, 200
    return {'error': 'Agent not found'}, 404

@agent_bp.route('/<int:agent_id>/tasks', methods=['GET'])
def get_tasks(agent_id):
    """Obtener las tareas de un Agente
    ---
    tags:
      - Agent 
    parameters:
      - name: agent_id
        in: path
        required: true
        type: integer
        description: ID del Agente
    responses:
      200:
        description: Lista de tareas
        examples:
          application/json: [{"id": 1,"command": "whoami", "arguments": "/all", "file": "base64"}]
    """
    agent = agent_service.get_agent(agent_id)
    if agent:
        tasks = agent.get_tasks()
        return {'tasks': [task.to_dict() for task in tasks]}, 200
    return {'error': 'Agent not found'}, 404

@agent_bp.route('/<int:agent_id>/results', methods=['GET'])
def get_results(agent_id):
    """Obtener los resultados de las tareas de un Agente
    ---
    tags:
      - Agent 
    parameters:
      - name: agent_id
        in: path
        required: true
        type: integer
        description: ID del Agente
    responses:
      200:
        description: Lista de resultados
        examples:
          application/json: [{"agent_id": 1,"task_id": 1,"result": "result test"}]
    """
    agent = agent_service.get_agent(agent_id)
    if agent:
        results = agent.get_results()
        return {'results': [result.to_dict() for result in results]}, 200
    return {'error': 'Agent not found'}, 404

@agent_bp.route('/<int:agent_id>/results/<int:task_id>', methods=['GET'])
def get_result(agent_id, task_id):
    """Obtener el resultado de una tarea
    ---
    tags:
      - Agent
    parameters:
      - name: agent_id
        in: path
        required: true
        type: integer
        description: ID del Agente
      - name: task_id
        in: path
        required: true
        type: integer
        description: ID de la tarea
    responses:
      200:
        description: Resultado de la tarea
        examples:
          application/json: {"agent_id": 1,"task_id": 1,"result": "result test"}
    """
    agent = agent_service.get_agent(agent_id)
    if agent:
        result = agent.get_result(task_id)
        if result:
            return result.to_dict(), 200
    return {'error': 'Task not found'}, 404