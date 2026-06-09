from typing import List
from flask import Blueprint, jsonify, request
from flask import current_app
from Models.Listener.http_listener.httplistener import HTTPListener
from Models.Listener.listener import Listener

listeners_bp = Blueprint('listeners', __name__)


def _svc():
    return current_app.extensions['listener_service']


def _agent_svc():
    return current_app.extensions['agent_service']


@listeners_bp.route('/', methods=['GET'])
def get_listeners():
    """
    Obtener todos los Listeners
    ---
    tags:
      - Listener
    responses:
      200:
        description: Lista de Listeners
    """
    return [listener.get_info() for listener in _svc().get_listeners()]


@listeners_bp.route('/<string:name>', methods=['GET'])
def get_listener(name):
    """
    Obtener Listener by name
    ---
    tags:
      - Listener
    parameters:
      - in: path
        name: name
        required: true
        type: string
    responses:
      200:
        description: Listener INFO
      404:
        description: Listener not found
    """
    listener = _svc().get_listener_by_name(name)
    if listener is None:
        return "Listener not found", 404
    return listener.get_info(), 200


@listeners_bp.route('/create', methods=['POST'])
def create_listener():
    """
    Crear un Listener
    ---
    tags:
      - Listener
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            type:
              type: string
              example: http
            name:
              type: string
              example: "Listener1"
            port:
              type: integer
              example: 8080
    responses:
      201:
        description: Listener creado
      500:
        description: El listener ya existe
    """
    data = request.get_json()
    if _svc().get_listener_by_name(data['name']) is not None:
        return jsonify({'error': f"Listener {data['name']} already exists"}), 409
    listener = HTTPListener(data['name'], port=data['port'], agent_service=_agent_svc())
    try:
        listener.start()
    except OSError as e:
        return jsonify({'error': f"Cannot bind to port {data['port']}: {e}"}), 409
    _svc().create_listener(listener)
    return jsonify(listener.get_info()), 201


@listeners_bp.route('/remove', methods=['DELETE'])
def remove_listener():
    """
    Eliminar un Listener
    ---
    tags:
      - Listener
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            name:
              type: string
              example: "Listener1"
    responses:
      200:
        description: Listener eliminado
      404:
        description: Listener not found
    """
    data = request.get_json()
    if not data or 'name' not in data:
        return "Invalid request data", 400

    listener: Listener = _svc().get_listener_by_name(data['name'])
    if listener is None:
        return f"Listener {data['name']} not found", 404

    try:
        listener.stop()
        if _svc().delete_listener(listener):
            return f"Listener {data['name']} deleted", 200
        return f"Can not delete listener {data['name']}", 409
    except Exception as e:
        return f"Error stopping listener {data['name']}: {str(e)}", 500
