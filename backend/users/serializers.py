import logging
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.utils.timezone import localtime

from .models import UserProfile, UserStats, UserActivityLog

logger = logging.getLogger(__name__)

class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["username"] = user.username
        token["is_admin"] = user.is_staff or user.is_superuser
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        try:
            profile, _ = UserProfile.objects.get_or_create(user=self.user)
            if not profile.is_online:
                profile.is_online = True
                profile.save(update_fields=["is_online"])

            UserActivityLog.objects.create(user=self.user, activity_type="login")
        except Exception as e:
            logger.error(f"Login status update failed: {e}")
        return data

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True,
                                     validators=[validate_password])
    password2 = serializers.CharField(write_only=True, required=True)
    email = serializers.EmailField(required=True)

    class Meta:
        model = User
        fields = ("username", "email", "password", "password2")

    def validate(self, attrs):
        if attrs["password"] != attrs["password2"]:
            raise serializers.ValidationError({"password": "Passwords do not match."})

        if User.objects.filter(email=attrs["email"]).exists():
            raise serializers.ValidationError({"email": "Email already used."})

        if User.objects.filter(username=attrs["username"]).exists():
            raise serializers.ValidationError({"username": "Username already taken."})

        return attrs

    def create(self, validated_data):
        return User.objects.create_user(
            username=validated_data["username"],
            email=validated_data["email"],
            password=validated_data["password"],
        )

class UserStatsSerializer(serializers.ModelSerializer):
    win_rate = serializers.IntegerField(read_only=True)
    global_rank = serializers.SerializerMethodField()
    rating = serializers.SerializerMethodField()
    rank = serializers.SerializerMethodField()

    class Meta:
        model = UserStats
        fields = ("total_battles", "win_rate", "current_streak",
                  "global_rank", "rating", "rank")

    def _get_profile(self, obj):
        try:
            return obj.user.userprofile
        except UserProfile.DoesNotExist:
            return None

    def get_rating(self, obj):
        p = self._get_profile(obj)
        return p.rating if p else 0

    def get_rank(self, obj):
        p = self._get_profile(obj)
        return p.rank if p else "Bronze"

    def get_global_rank(self, obj):
        p = self._get_profile(obj)
        if not p:
            return None
        higher = UserProfile.objects.filter(rating__gt=p.rating).count()
        return higher + 1

class UserProfileSerializer(serializers.ModelSerializer):
    rating = serializers.SerializerMethodField()
    rank = serializers.SerializerMethodField()
    global_rank = serializers.SerializerMethodField()

    preferred_language = serializers.SerializerMethodField()
    preferred_difficulty = serializers.SerializerMethodField()

    is_online = serializers.SerializerMethodField()
    last_seen = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "rating",
            "rank",
            "global_rank",
            "preferred_language",
            "preferred_difficulty",
            "is_online",
            "last_seen",
        )

    def _get_profile(self, obj):
        try:
            return obj.userprofile
        except UserProfile.DoesNotExist:
            return None

    def get_rating(self, obj):
        p = self._get_profile(obj)
        return p.rating if p else 0

    def get_rank(self, obj):
        p = self._get_profile(obj)
        return p.rank if p else "Bronze"

    def get_global_rank(self, obj):
        p = self._get_profile(obj)
        if not p:
            return None
        higher = UserProfile.objects.filter(rating__gt=p.rating).count()
        return higher + 1

    def get_preferred_language(self, obj):
        p = self._get_profile(obj)
        return p.preferred_language if p else "cpp"

    def get_preferred_difficulty(self, obj):
        p = self._get_profile(obj)
        return p.preferred_difficulty if p else "easy"

    def get_is_online(self, obj):
        p = self._get_profile(obj)
        return p.is_online if p else False

    def get_last_seen(self, obj):
        p = self._get_profile(obj)
        if not p or not p.last_seen:
            return None
        return localtime(p.last_seen).isoformat(timespec="seconds")
