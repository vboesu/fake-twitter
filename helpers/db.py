import datetime
from peewee import *

db = SqliteDatabase("twitter.db", pragmas={"foreign_keys": 1})


class Base(Model):
    class Meta:
        database = db


class Room(Base):
    name = CharField()
    slug = CharField(unique=True)
    password = CharField()
    user_tweet_rate = FloatField(default=20.0)  # seconds between tweets for user
    tweet_refresh_rate = FloatField(default=10.0)  # seconds between tweets released
    tweet_highlight_length = FloatField(default=20.0)  # how long highlight stays up
    created = DateTimeField(default=datetime.datetime.now)

    def to_dict(self):
        return {
            "slug": self.slug,
            "name": self.name,
            "user_tweet_rate": self.user_tweet_rate,
            "tweet_refresh_rate": self.tweet_refresh_rate,
            "tweet_highlight_length": self.tweet_highlight_length,
        }

    class Meta:
        table_name = "rooms"


class User(Base):
    room = ForeignKeyField(Room, on_delete="CASCADE", on_update="CASCADE")
    handle = CharField()
    name = CharField()
    created = DateTimeField(default=datetime.datetime.now)

    @property
    def profile_image(self):
        return f"/{self.room.slug}/users/{self.handle}/image"

    def tweets(self, return_deleted=False):
        if return_deleted:
            return Tweet.select().where(Tweet.user == self)
        else:
            return (
                Tweet.select()
                .where(
                    (Tweet.user == self)
                    & Tweet.id.not_in([td.tweet for td in TweetDelete.select()])
                )
                .order_by(Tweet.created.desc())
            )

    def to_dict(self):
        return {
            "id": self.id,
            "handle": "@" + self.handle,
            "name": self.name,
            "profile_image": self.profile_image,
        }

    class Meta:
        table_name = "users"
        indexes = ((("room", "handle"), True),)


class Tweet(Base):
    room = ForeignKeyField(Room, on_delete="CASCADE", on_update="CASCADE")
    user = ForeignKeyField(User, on_delete="CASCADE", on_update="CASCADE")
    text = CharField()
    release = DateTimeField(default=None)
    created = DateTimeField(default=datetime.datetime.now)

    @property
    def highlighted(self):
        highlight = (
            TweetHighlight.select()
            .where(TweetHighlight.tweet == self)
            .order_by(TweetHighlight.created.desc())
            .get_or_none()
        )
        if (
            highlight is not None
            and highlight.created
            + datetime.timedelta(seconds=self.room.tweet_highlight_length)
            >= datetime.datetime.now()
        ):
            return highlight.created

    def to_dict(self):
        return {
            "id": self.id,
            "user": self.user.to_dict(),
            "text": self.text,
            "deleted": bool(
                TweetDelete.select().where(TweetDelete.tweet == self).count()
            ),
            "highlighted": self.highlighted,
            "release": self.release.isoformat(),
            "created": self.created.isoformat(),
        }

    def save(self, *args, **kwargs):
        if self.release is None:
            # get latest tweet
            last_tweet = (
                Tweet.select()
                .where(Tweet.room == self.room)
                .order_by(Tweet.created.desc())
                .get_or_none()
            )
            if last_tweet is not None:
                # this adds the tweet to a queue
                self.release = max(
                    self.created,
                    last_tweet.release
                    + datetime.timedelta(seconds=self.room.tweet_refresh_rate),
                )
            else:
                self.release = self.created
        super().save(*args, **kwargs)

    class Meta:
        table_name = "tweets"


class TweetHighlight(Base):
    tweet = ForeignKeyField(Tweet, on_delete="CASCADE", on_update="CASCADE")
    created = DateTimeField(default=datetime.datetime.now)

    class Meta:
        table_name = "tweet_highlights"


class TweetDelete(Base):
    tweet = ForeignKeyField(Tweet, on_delete="CASCADE", on_update="CASCADE")
    created = DateTimeField(default=datetime.datetime.now)

    class Meta:
        table_name = "tweet_deletes"


db.connect()
db.create_tables([Room, User, Tweet, TweetHighlight, TweetDelete])
