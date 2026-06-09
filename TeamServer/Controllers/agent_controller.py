import base64
import datetime
import secrets
from flask import Blueprint, request, Response
from flask import current_app
from Models.Agent.agent import Agent
from Models.Agent.agent_metadata import AgentMetadata
from Models.Agent.task import Task


agent_bp = Blueprint('agents', __name__)


def _svc():
    return current_app.extensions['agent_service']


def _agent_dict(agent: Agent) -> dict:
    d = agent.get_metadata().to_dict()
    ls = agent.lastseen
    if isinstance(ls, datetime.datetime):
        ls = ls.isoformat()
    d['lastseen'] = ls
    return d


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
    """
    return {'agents': [_agent_dict(a) for a in _svc().get_agents()]}


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
    responses:
      200:
        description: Detalles del Agente
      404:
        description: Agente no encontrado
    """
    agent = _svc().get_agent(agent_id)
    if agent:
        return _agent_dict(agent)
    return {'error': 'Agent not found'}, 404


@agent_bp.route('/<int:agent_id>/checkin', methods=['POST'])
def checkin_agent(agent_id):
    agent = _svc().get_agent(agent_id)
    if agent:
        _svc().checkin_agent(agent)
        return {'message': 'Agent checked in successfully'}
    return {'error': 'Agent not found'}, 404


@agent_bp.route('/<int:agent_id>/checkout', methods=['POST'])
def checkout_agent(agent_id):
    agent = _svc().get_agent(agent_id)
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
    responses:
      200:
        description: Agente eliminado con éxito
      404:
        description: Agente no encontrado
    """
    agent = _svc().get_agent(agent_id)
    if agent:
        _svc().remove_agent(agent)
        return {'message': 'Agent deleted successfully'}
    return {'error': 'Agent not found'}, 404


@agent_bp.route('/', methods=['POST'])
def create_agent():
    """Crear un nuevo Agente
    ---
    tags:
      - Agent
    responses:
      201:
        description: Agente creado
      400:
        description: El agente ya existe
    """
    agent_data = request.json
    agent_metadata = AgentMetadata(
        id=agent_data.get("id"),
        hostname=agent_data.get("hostname"),
        username=agent_data.get("username"),
        processname=agent_data.get("processname"),
        pid=agent_data.get("pid"),
        integrity=agent_data.get("integrity"),
        arch=agent_data.get("arch"),
    )
    if _svc().get_agent(agent_metadata.get_id()) is not None:
        return {'error': 'Agent already exists'}, 400
    agent = Agent(agent_metadata)
    _svc().add_agent(agent)
    return {'agent': _agent_dict(agent)}, 201


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
    responses:
      200:
        description: Tarea añadida
      404:
        description: Agente no encontrado
    """
    agent = _svc().get_agent(agent_id)
    if agent:
        task_data = request.json
        task = Task(
            id=secrets.randbelow(2 ** 31),
            command=task_data.get("command"),
            arguments=task_data.get("arguments"),
            file=task_data.get("file"),
            file2=task_data.get("file2"),
            filename=task_data.get("filename"),
        )
        _svc().add_task(agent, task)
        return {'message': 'Task added successfully', 'task_id': task.id}, 200
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
    responses:
      200:
        description: Lista de tareas
    """
    agent = _svc().get_agent(agent_id)
    if agent:
        return {'tasks': [task.to_dict() for task in agent.get_tasks()]}, 200
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
    responses:
      200:
        description: Lista de resultados
    """
    agent = _svc().get_agent(agent_id)
    if agent:
        return {'results': [r.to_dict() for r in agent.get_results()]}, 200
    return {'error': 'Agent not found'}, 404


@agent_bp.route('/<int:agent_id>/results/<int:task_id>/file', methods=['GET'])
def download_file(agent_id, task_id):
    agent = _svc().get_agent(agent_id)
    if not agent:
        return {'error': 'Agent not found'}, 404
    result = agent.get_result(task_id)
    if not result:
        return {'error': 'Task not found'}, 404
    r = result.get_result()
    if not r.startswith("FILE:"):
        return {'error': 'Not a file result'}, 400
    parts = r.split(":", 2)
    if len(parts) != 3:
        return {'error': 'Invalid file result'}, 400
    filename = parts[1]
    data = base64.b64decode(parts[2])
    return Response(
        data,
        mimetype='application/octet-stream',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'},
    )


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
      - name: task_id
        in: path
        required: true
        type: integer
    responses:
      200:
        description: Resultado de la tarea
      404:
        description: Tarea no encontrada
    """
    agent = _svc().get_agent(agent_id)
    if agent:
        result = agent.get_result(task_id)
        if result:
            return result.to_dict(), 200
    return {'error': 'Task not found'}, 404
