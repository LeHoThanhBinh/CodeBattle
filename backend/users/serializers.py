import logging
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password

from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import UserProfile, UserStats, UserActivityLog

logger = logging.getLogger(__name__)

# ======================================================
# AUTH SERIALIZERS
# ======================================================

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
            logger.error(
                f"Lỗi khi cập nhật trạng thái/ghi log (user: {self.user.username}): {e}"
            )
        return data


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True, required=True, validators=[validate_password]
    )
    password2 = serializers.CharField(write_only=True, required=True)
    email = serializers.EmailField(required=True)

    class Meta:
        model = User
        fields = ("username", "email", "password", "password2")

    def validate(self, attrs):
        if attrs["password"] != attrs["password2"]:
            raise serializers.ValidationError({"password": "Mật khẩu không khớp."})

        if User.objects.filter(email=attrs["email"]).exists():
            raise serializers.ValidationError({"email": "Email này đã được sử dụng."})
        if User.objects.filter(username=attrs["username"]).exists():
            raise serializers.ValidationError(
                {"username": "Username này đã được sử dụng."}
            )
        return attrs

    def create(self, validated_data):
        return User.objects.create_user(
            username=validated_data["username"],
            email=validated_data["email"],
            password=validated_data["password"],
        )

# ======================================================
# USER STATS SERIALIZER
# (cho /api/stats/ và /api/stats/<user_id>/)
# ======================================================

class UserStatsSerializer(serializers.ModelSerializer):
    win_rate = serializers.IntegerField(read_only=True)
    global_rank = serializers.SerializerMethodField()
    rating = serializers.SerializerMethodField()
    rank = serializers.SerializerMethodField()

    class Meta:
        model = UserStats
        fields = (
            "total_battles",
            "win_rate",
            "current_streak",
            "global_rank",
            "rating",
            "rank",
        )

    def _get_rating(self, obj):
        try:
            return obj.user.userprofile.rating or 0
        except (UserProfile.DoesNotExist, AttributeError):
            return 0

    def get_rating(self, obj):
        return self._get_rating(obj)

    def get_global_rank(self, obj):
        try:
            rating = self._get_rating(obj)
            higher = UserProfile.objects.filter(rating__gt=rating).count()
            return higher + 1
        except Exception:
            return None

    def get_rank(self, obj):
        rating = self._get_rating(obj)
        if rating <= 1000:
            return "Bronze"
        elif rating <= 2000:
            return "Silver"
        elif rating <= 3000:
            return "Gold"
        else:
            return "Platinum"

# ======================================================
# USER PROFILE SERIALIZER (model = User)
# /api/profile/, /api/leaderboard/, /api/online-players/
# ======================================================

class UserProfileSerializer(serializers.ModelSerializer):
    rating = serializers.IntegerField(
        source="userprofile.rating", read_only=True, default=0
    )
    preferred_language = serializers.CharField(
        source="userprofile.preferred_language", read_only=True
    )
    preferred_difficulty = serializers.CharField(
        source="userprofile.preferred_difficulty", read_only=True
    )

    global_rank = serializers.SerializerMethodField()
    rank = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "rating",
            "global_rank",
            "rank",
            "preferred_language",
            "preferred_difficulty",
        )

    def get_global_rank(self, obj):
        try:
            rating = obj.userprofile.rating
            if rating is None:
                return None
            higher = UserProfile.objects.filter(rating__gt=rating).count()
            return higher + 1
        except (UserProfile.DoesNotExist, AttributeError):
            return None

    def get_rank(self, obj):
        try:
            rating = obj.userprofile.rating or 0
        except (UserProfile.DoesNotExist, AttributeError):
            rating = 0

        if rating <= 1000:
            return "Bronze"
        elif rating <= 2000:
            return "Silver"
        elif rating <= 3000:
            return "Gold"
        else:
            return "Platinum"
