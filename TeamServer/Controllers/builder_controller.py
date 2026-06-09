from flask import Blueprint, jsonify, request, send_file, abort
from flask import current_app
from Models.Build.build import BuildStatus

builder_bp = Blueprint('builder', __name__)

VALID_ARCHS = ('x64', 'x86', 'ARM64')


def _svc():
    return current_app.extensions['builder_service']


@builder_bp.route('/check', methods=['GET'])
def check_tools():
    """
    Check which pre-compiled base DLLs are available for patching
    ---
    tags:
      - Builder
    responses:
      200:
        description: DLL availability per architecture
    """
    return jsonify(_svc().check())


@builder_bp.route('/', methods=['GET'])
def list_builds():
    """
    List all builds
    ---
    tags:
      - Builder
    responses:
      200:
        description: List of builds
    """
    return jsonify([b.to_dict() for b in _svc().get_all_builds()])


@builder_bp.route('/', methods=['POST'])
def create_build():
    """
    Start a new agent build
    ---
    tags:
      - Builder
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            host:
              type: string
            port:
              type: integer
            arch:
              type: string
              enum: [x64, x86, ARM64]
            sleep_ms:
              type: integer
            jitter_ms:
              type: integer
    responses:
      202:
        description: Build accepted and queued
      400:
        description: Invalid parameters
    """
    data = request.get_json(force=True) or {}

    host = str(data.get('host', '')).strip()
    if not host:
        return jsonify({'error': 'host is required'}), 400

    try:
        port = int(data.get('port', 0))
    except (TypeError, ValueError):
        return jsonify({'error': 'port must be an integer'}), 400
    if not (1 <= port <= 65535):
        return jsonify({'error': 'port must be between 1 and 65535'}), 400

    arch = str(data.get('arch', 'x64'))
    if arch not in VALID_ARCHS:
        return jsonify({'error': f'arch must be one of {list(VALID_ARCHS)}'}), 400

    try:
        sleep_ms = int(data.get('sleep_ms', 5000))
    except (TypeError, ValueError):
        return jsonify({'error': 'sleep_ms must be an integer'}), 400
    if sleep_ms < 100:
        return jsonify({'error': 'sleep_ms must be at least 100'}), 400

    try:
        jitter_ms = int(data.get('jitter_ms', 1000))
    except (TypeError, ValueError):
        return jsonify({'error': 'jitter_ms must be an integer'}), 400
    if jitter_ms < 0:
        return jsonify({'error': 'jitter_ms must be >= 0'}), 400
    if jitter_ms >= sleep_ms:
        return jsonify({'error': 'jitter_ms must be less than sleep_ms'}), 400

    build = _svc().create_build(host, port, arch, sleep_ms, jitter_ms)
    return jsonify(build.to_dict()), 202


@builder_bp.route('/<string:build_id>', methods=['GET'])
def get_build(build_id):
    """
    Get build status
    ---
    tags:
      - Builder
    parameters:
      - name: build_id
        in: path
        required: true
        type: string
    responses:
      200:
        description: Build object
      404:
        description: Build not found
    """
    build = _svc().get_build(build_id)
    if not build:
        return jsonify({'error': 'Build not found'}), 404
    return jsonify(build.to_dict())


@builder_bp.route('/<string:build_id>/download', methods=['GET'])
def download_build(build_id):
    """
    Download the compiled DLL for a successful build
    ---
    tags:
      - Builder
    parameters:
      - name: build_id
        in: path
        required: true
        type: string
    responses:
      200:
        description: DLL binary
      404:
        description: Build or artifact not found
      409:
        description: Build not in success state
    """
    build = _svc().get_build(build_id)
    if not build:
        abort(404)
    if build.status != BuildStatus.SUCCESS:
        return jsonify({'error': 'Build not ready for download'}), 409

    path = _svc().artifact_path(build_id)
    if not path:
        abort(404)

    filename = f"agent_{build.arch.lower()}_{build.host}_{build.port}.dll"
    return send_file(str(path), as_attachment=True, download_name=filename,
                     mimetype='application/octet-stream')


@builder_bp.route('/<string:build_id>', methods=['DELETE'])
def delete_build(build_id):
    """
    Delete a build record and its artifact
    ---
    tags:
      - Builder
    parameters:
      - name: build_id
        in: path
        required: true
        type: string
    responses:
      200:
        description: Deleted
      404:
        description: Build not found
    """
    ok, reason = _svc().delete_build(build_id)
    if not ok:
        if reason == 'not_found':
            return jsonify({'error': 'Build not found'}), 404
        return jsonify({'error': 'Cannot delete a build that is still in progress'}), 409
    return jsonify({'message': 'Build deleted'}), 200
