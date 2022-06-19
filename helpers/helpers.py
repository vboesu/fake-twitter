import re
import json
import os

from flask import redirect, session, render_template, make_response, request

from functools import wraps

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg"}


def json_filter(value):
    """Format value as valid json."""
    return json.dumps(value)


def is_hex(string):
    """Check if string is a six digit hexadecimal string"""
    return bool(re.search(r"^[A-Fa-f0-9]{6}$", string.lstrip("#")))


def allowed_file(filename):
    """Check if file extension is in ALLOWED_EXTENSIONS"""
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def camel_to_snake(name):
    # Source: https://stackoverflow.com/questions/1175208/elegant-python-function-to-convert-camelcase-to-snake-case
    name = re.sub("(.)([A-Z][a-z]+)", r"\1_\2", name)
    return re.sub("([a-z0-9])([A-Z])", r"\1_\2", name).lower()


def delete_all_files_in_folder(path):
    if not os.path.exists(path):
        os.makedirs(path)
    # shutil.rmtree(path, ignore_errors=False, onerror=None)


def delete_file(path):
    if os.path.exists(path):
        os.remove(path)


def template(file, *args, **kwargs):
    env = {"moderator_for_room": session.get("moderator_for_room")}
    return render_template(file, *args, env=env, **kwargs)


def api_error(message, status=404, **kwargs):
    response = {"message": message, **kwargs}
    return make_response(response, status)


def logged_in(room):
    return "moderator_for_room" in session and session["moderator_for_room"] == room


def invalid_form(request, keys):
    for key in keys:
        if not request.form.get(key):
            return key


# Taken from CS50 finance p-set, adapted
def login_required_api(f):
    """
    Decorate routes to require login for API.

    https://flask.palletsprojects.com/en/1.1.x/patterns/viewdecorators/
    """

    @wraps(f)
    def decorated_function(*args, **kwargs):
        if current_user() is None:
            return api_error("Unauthorized", status=401)
        return f(*args, **kwargs)

    return decorated_function
