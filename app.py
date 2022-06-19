import os

from flask import Flask, redirect, request, render_template, send_file, make_response
from flask_session import Session

from werkzeug.exceptions import default_exceptions, HTTPException, InternalServerError

from helpers import template, api_error, Room, User, logged_in

from api import UPLOAD_FOLDER, api

# # Configure application
app = Flask(__name__)
app.register_blueprint(api, url_prefix="/api")
app.config["MAX_CONTENT_LENGTH"] = 8 * 1024 * 1024

# Ensure templates are auto-reloaded
app.config["TEMPLATES_AUTO_RELOAD"] = True

# Configure session to use filesystem (instead of signed cookies)
app.config["SESSION_PERMANENT"] = False
app.config["SESSION_TYPE"] = "filesystem"
Session(app)


@app.route("/")
def index():
    return template("start.html")


@app.route("/<room_slug>")
def room_router(room_slug: str):
    """If no room exists, create a new one; otherwise show feed"""
    room = Room.get_or_none(slug=room_slug)
    if room is not None:
        # room exists, redirect
        return template("timeline.html", room=room_slug)
    else:
        # room does not exist yet, create
        return template("create_room.html", room=room_slug)


@app.route("/<room_slug>/admin")
def room_admin(room_slug: str):
    """Admin view"""
    if not logged_in(room_slug):
        return redirect(f"/{room_slug}/login")

    room = Room.get_or_none(slug=room_slug)
    return template("admin.html", room=room)


@app.route("/<room_slug>/login")
def room_login(room_slug: str):
    """Login view for admin"""
    if logged_in(room_slug):
        return redirect(f"/{room_slug}/admin")

    return template("login.html", room=room_slug)


@app.route("/<room_slug>/users/<user_slug>")
def post_as_user(room_slug: str, user_slug: str):
    room = Room.get_or_none(slug=room_slug)
    if room is None:
        return redirect("/")

    user = User.get_or_none(room=room, handle=user_slug)
    if user is None:
        return redirect(f"/{room.slug}")

    return template("post.html", room=room_slug, user=user)


@app.route("/<room_slug>/users/<user_handle>/image")
def user_profile_picture(room_slug: str, user_handle: str):
    room = Room.get_or_none(slug=room_slug)
    user = User.get(User.room == room.id, User.handle == user_handle)
    filename = os.path.join(UPLOAD_FOLDER, room.slug + "." + user.handle + ".jpg")
    if os.path.exists(filename):
        return send_file(
            os.path.join(UPLOAD_FOLDER, room.slug + "." + user.handle + ".jpg")
        )
    else:
        return make_response("", 404)


if __name__ == "__main__":
    app.run()
