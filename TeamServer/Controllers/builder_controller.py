from flask import Blueprint, jsonify, request, send_file, abort
from Models.Build.build import BuildStatus
from Services.builder_service import BuilderService

builder_service = BuilderService()
builder_bp = Blueprint('builder', __name__)

VALID_ARCHS = ('x64', 'x86', 'ARM64')


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
        examples:
          application/json: {"available": true, "archs": {"x64": true, "x86": false, "ARM64": false}}
    """
    return jsonify(builder_service.check())


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
    return jsonify([b.to_dict() for b in builder_service.get_all_builds()])


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
              example: "192.168.1.10"
            port:
              type: integer
              example: 4444
            arch:
              type: string
              enum: [x64, x86, ARM64]
              example: "x64"
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

    build = builder_service.create_build(host, port, arch)
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
    build = builder_service.get_build(build_id)
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
    build = builder_service.get_build(build_id)
    if not build:
        abort(404)
    if build.status != BuildStatus.SUCCESS:
        return jsonify({'error': 'Build not ready for download'}), 409

    path = builder_service.artifact_path(build_id)
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
    build = builder_service.get_build(build_id)
    if not build:
        return jsonify({'error': 'Build not found'}), 404
    if build.status in (BuildStatus.PENDING, BuildStatus.RUNNING):
        return jsonify({'error': 'Cannot delete a build that is still in progress'}), 409
    builder_service.delete_build(build_id)
    return jsonify({'message': 'Build deleted'}), 200
