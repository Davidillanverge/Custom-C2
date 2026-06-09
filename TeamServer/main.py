import logging
import os
from flask import Flask
from flask_cors import CORS
from flasgger import Swagger
from Database.database import Database
from Services.agent_service import AgentService
from Services.listeners_service import ListenerService
from Services.builder_service import BuilderService
from Controllers.listeners_controller import listeners_bp
from Controllers.agent_controller import agent_bp
from Controllers.builder_controller import builder_bp


def create_app():
    logging.basicConfig(
        level=logging.DEBUG if os.getenv('FLASK_DEBUG') else logging.INFO,
        format='%(asctime)s %(levelname)s %(name)s: %(message)s',
    )

    app = Flask(__name__)
    CORS(app)

    app.config['SWAGGER'] = {'title': 'TeamServer C2', 'uiversion': 3}
    Swagger(app)

    db = Database()
    app.extensions['agent_service']    = AgentService(db)
    app.extensions['listener_service'] = ListenerService()
    app.extensions['builder_service']  = BuilderService(db)

    app.register_blueprint(listeners_bp, url_prefix='/listeners')
    app.register_blueprint(agent_bp,     url_prefix='/agents')
    app.register_blueprint(builder_bp,   url_prefix='/builder')

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(debug=bool(os.getenv('FLASK_DEBUG')), port=8000)
