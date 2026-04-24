from flask import Flask
from flask_cors import CORS
from flasgger import Swagger
from Controllers.listeners_controller import listeners_bp
from Controllers.agent_controller import agent_bp
from Controllers.builder_controller import builder_bp

def create_app():
    app = Flask(__name__)

    # Enable CORS for all routes
    CORS(app)

    # Configuración de Swagger
    app.config['SWAGGER'] = {
        'title': 'Mi API',
        'uiversion': 3
    }
    swagger = Swagger(app)

    # Registrar Blueprints
    app.register_blueprint(listeners_bp, url_prefix='/listeners')
    app.register_blueprint(agent_bp, url_prefix='/agents')
    app.register_blueprint(builder_bp, url_prefix='/builder')

    return app

if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, port=8000)
