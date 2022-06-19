import peewee
import json
import os
import datetime

from pathlib import Path
from PIL import Image

from flask import Blueprint, request, redirect, session
from werkzeug.security import check_password_hash, generate_password_hash

from helpers.helpers import delete_file

api = Blueprint("api", __name__)

from helpers import (
    delete_all_files_in_folder,
    api_error,
    invalid_form,
    logged_in,
    allowed_file,
    delete_file,
)

# import models
from helpers import User, Room, Tweet, TweetDelete, TweetHighlight

# Configure file uploads
UPLOAD_FOLDER = Path(__file__).parent / "uploads"
delete_all_files_in_folder(UPLOAD_FOLDER)


@api.route("/rooms/create", methods=["POST"])
def create_room():
    # validate form
    if key := invalid_form(request, ["room", "name", "password"]):
        return api_error(f"Missing argument: {key}", status=400)

    password_hash = generate_password_hash(request.form.get("password"))

    # create room
    room = Room.create(
        slug=request.form.get("room"),
        name=request.form.get("name"),
        password=password_hash,
    )

    # log in
    session["moderator_for_room"] = room.slug
    return redirect(f"/{room.slug}/admin")


@api.route("/rooms/<room_slug>/login", methods=["POST"])
def login_room(room_slug: str):
    # validate form
    if key := invalid_form(request, ["password"]):
        return api_error(f"Missing argument: {key}", status=400)

    room = Room.get_or_none(slug=room_slug)
    if room is None:
        return api_error(f"Invalid room", status=400)

    if not check_password_hash(room.password, request.form.get("password")):
        return redirect(f"/{room.slug}/login")

    # log in
    session["moderator_for_room"] = room.slug
    return redirect(f"/{room.slug}/admin")


@api.route("/rooms/<room_slug>/settings", methods=["POST"])
def room_settings(room_slug: str):
    if not logged_in(room_slug):
        return api_error("Not logged in", status=401)

    room = Room.get_or_none(slug=room_slug)
    if room is None:
        return api_error(f"Invalid room", status=400)

    try:
        room.user_tweet_rate = max(float(request.form.get("user_tweet_rate")), 0)
        room.tweet_refresh_rate = max(float(request.form.get("tweet_refresh_rate")), 0)
        room.tweet_highlight_length = max(
            float(request.form.get("tweet_highlight_length")), 0
        )
    except:
        return api_error("Invalid values", status=400)

    room.save()
    return {}


@api.route("/rooms/<room_slug>/feed", methods=["GET"])
def room_feed(room_slug: str):
    room = Room.get_or_none(slug=room_slug)
    if room is None:
        return api_error(f"Invalid room", status=400)

    # if the user is logged in and in admin mode, return all tweets (including deleted and unreleased ones)
    if logged_in(room.slug) and bool(request.args.get("deleted")):
        tweets = [
            t.to_dict()
            for t in Tweet.select()
            .where(Tweet.room == room)
            .order_by(Tweet.created.desc())
        ]
    else:
        tweets = [
            t.to_dict()
            for t in Tweet.select()
            .where(
                (Tweet.room == room)
                & (Tweet.id.not_in([td.tweet.id for td in TweetDelete.select()]))
                & (Tweet.release <= datetime.datetime.now())
            )
            .order_by(Tweet.created.desc())
        ]

    # account for highlights
    tweets = sorted(
        tweets,
        key=lambda x: (
            x["highlighted"] if x["highlighted"] is not None else datetime.datetime.min,
            x["created"],
        ),
        reverse=True,
    )

    # prepare for json
    for idx, tweet in enumerate(tweets):
        if tweet["highlighted"] is not None:
            tweets[idx]["highlighted"] = tweet["highlighted"].isoformat()

    return json.dumps(tweets)


@api.route("/rooms/<room_slug>/users", methods=["GET"])
def room_users(room_slug: str):
    """Return list of all users in room"""
    room = Room.get_or_none(slug=room_slug)
    if room is None:
        return api_error(f"Invalid room", status=400)

    users = [u.to_dict() for u in User.select().where(User.room == room)]
    return json.dumps(users)


@api.route("/rooms/<room_slug>/delete", methods=["GET"])
def room_delete(room_slug: str):
    """Delete room"""
    if not logged_in(room_slug):
        return api_error("Not logged in", status=401)

    room = Room.get_or_none(slug=room_slug)
    if room is None:
        return api_error("Invalid room", status=400)

    room.delete_instance()
    return redirect("/")


@api.route("/rooms/<room_slug>/export", methods=["GET"])
def room_export(room_slug: str):
    """Export room"""
    if not logged_in(room_slug):
        return api_error("Not logged in", status=401)

    room = Room.get_or_none(slug=room_slug)
    if room is None:
        return api_error("Invalid room", status=400)

    # get all tweets and users, including deleted tweets
    tweets = [t.to_dict() for t in Tweet.select().where(Tweet.room == room)]
    users = [u.to_dict() for u in User.select().where(User.room == room)]

    return json.dumps({"tweets": tweets, "users": users})


# USER FUNCTIONS
@api.route("/users/create", methods=["POST"])
def room_create_user():
    """Create user in room"""
    # validate form
    if key := invalid_form(request, ["room", "handle", "name"]):
        return api_error(f"Missing argument: {key}", status=400)

    if not logged_in(request.form.get("room")):
        return api_error(f"Unauthorized", status=401)

    # validate form
    if key := invalid_form(request, ["handle", "name"]):
        return api_error(f"Missing argument: {key}", status=400)

    if "file" not in request.files:
        return api_error("No file provided", status=400)

    file = request.files["file"]
    if not file.filename:
        return api_error("No file provided", status=400)

    if not allowed_file(file.filename):
        return api_error("Invalid file format", status=400)

    room = Room.get_or_none(slug=request.form.get("room"))
    if room is None:
        return api_error(f"Invalid room", status=400)

    # create user from scratch
    try:
        user = User.create(
            room=room, name=request.form.get("name"), handle=request.form.get("handle")
        )
        user.save()

        # Convert to jpg
        img = Image.open(file)
        filename = os.path.join(UPLOAD_FOLDER, room.slug + "." + user.handle + ".jpg")
        img.save(filename)
    except peewee.IntegrityError:
        return api_error(
            f"User with handle {request.form.get('handle')} already exists", status=400
        )

    return {"user_id": user.id}


@api.route("/users/<user_id>/feed", methods=["GET"])
def user_feed(user_id: int):
    """Feed of user"""
    user = User.get_or_none(id=user_id)
    if user is None:
        return api_error("Invalid user", status=400)

    tweets = [t.to_dict() for t in user.tweets()]

    return json.dumps(tweets)


@api.route("/users/<user_id>/delete", methods=["GET"])
def room_delete_user(user_id: int):
    """Delete user"""
    user = User.get_or_none(id=user_id)
    if user is None:
        return api_error("Invalid user", status=400)

    if not logged_in(user.room.slug):
        return api_error(f"Unauthorized", status=401)

    # delete profile picture
    filename = os.path.join(UPLOAD_FOLDER, user.room.slug + "." + user.handle + ".jpg")
    delete_file(filename)

    # delete instance
    user.delete_instance()
    return {}


# TWEET FUNCTIONS
@api.route("/tweets/create", methods=["POST"])
def create_tweet():
    """Create tweet in room"""
    # validate form
    if key := invalid_form(request, ["room", "handle", "content"]):
        return api_error(f"Missing argument: {key}", status=400)

    room = Room.get_or_none(slug=request.form.get("room"))
    if room is None:
        return api_error(f"Invalid room", status=400)

    user = User.get_or_none(room=room, handle=request.form.get("handle"))
    if user is None:
        return api_error(f"Invalid user", status=400)

    # check for tweet rate
    last_tweet = (
        Tweet.select()
        .where(Tweet.user == user)
        .order_by(Tweet.created.desc())
        .get_or_none()
    )

    if last_tweet is not None:
        diff = (datetime.datetime.now() - last_tweet.created).total_seconds()
        if diff < room.user_tweet_rate:
            return api_error(
                f"Please wait {round(room.user_tweet_rate - diff)} seconds before tweeting again",
                status=400,
            )

    tweet = Tweet.create(room=room, user=user, text=request.form.get("content")[:280])
    tweet.save()

    return {}


@api.route("/tweets/<tweet_id>/delete", methods=["GET"])
def delete_tweet(tweet_id: int):
    """Delete tweet"""
    tweet = Tweet.get_or_none(id=tweet_id)
    if tweet is None:
        return api_error("Invalid tweet", status=400)

    if not logged_in(tweet.room.slug):
        return api_error(f"Unauthorized", status=401)

    # instead of deleting the tweet, mark as deleted
    tweet_delete = TweetDelete.create(tweet=tweet)
    tweet_delete.save()

    return {}


@api.route("/tweets/<tweet_id>/highlight", methods=["GET"])
def highlight_tweet(tweet_id: int):
    """Highligh tweet"""
    tweet = Tweet.get_or_none(id=tweet_id)
    if tweet is None:
        return api_error("Invalid tweet", status=400)

    if not logged_in(tweet.room.slug):
        return api_error(f"Unauthorized", status=401)

    tweet_highlight = TweetHighlight.create(tweet=tweet)
    tweet_highlight.save()

    return {}
