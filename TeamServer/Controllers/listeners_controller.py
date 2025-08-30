from typing import List
from flask import Blueprint, jsonify, request
from flask import current_app as app
from Models.Listener.http_listener.httplistener import HTTPListener
from Models.Listener.listener import Listener
from Services.listeners_service import ListenerService

listener_service : ListenerService = ListenerService()

listeners_bp = Blueprint('listeners', __name__)

# Ejemplo: obtener todos los usuarios
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
        examples:
          application/json: [{"host": "0.0.0.0","name": "Listener1", "port": 8080},{"host": "0.0.0.0", "name": "Listener2", "port": 8080}]
    """
    listeners: List[HTTPListener] = listener_service.get_listeners()
    return [listener.get_info() for listener in listeners]

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
        example: "Listener1"
    responses:
      200:
        description: Listener INFO
        examples:
          application/json: [{"host": "0.0.0.0","name": "Listener1", "port": 8080}]
    """
    listener = listener_service.get_listener_by_name(name)
    if listener == None:
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
        type: body
        required: true
        name: body
        required: true
        port: body
        required: false
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
              type: int
              example: 8080
    responses:
      201:
        description: Listener creado
        examples:
          application/json: {"type": "http", "name":"Listener1", "port":8080}
    """
    data = request.get_json()
    #TODO: Check listener type
    listener = listener_service.get_listener_by_name(data['name'])
    if listener != None:
          return f"Listener {data['name']} already exists", 500
    listener = HTTPListener(data['name'], port=data['port'])
    listener.start()  
    listener_service.create_listener(listener)
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
      201:
        description: Listener creado
        examples:
          application/json: {"name":"Listener1", "port":8080}
    """
    data = request.get_json()
    listener: Listener = listener_service.get_listener_by_name(data['name'])
    listener.stop()
    if listener_service.delete_listener(listener):
      return f"Listener {data['name']} deleted", 201
    else: return f"Can not delete listener {data['name']}", 409
