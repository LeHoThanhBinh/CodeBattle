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
# USER STATS SERIALIZER (/api/stats/)
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

    def _get_profile(self, obj):
        try:
            return obj.user.userprofile
        except UserProfile.DoesNotExist:
            return None

    def get_rating(self, obj):
        profile = self._get_profile(obj)
        return profile.rating if profile else 0

    def get_rank(self, obj):
        profile = self._get_profile(obj)
        return profile.rank if profile else "Bronze"

    def get_global_rank(self, obj):
        profile = self._get_profile(obj)
        if not profile:
            return None
        higher = UserProfile.objects.filter(rating__gt=profile.rating).count()
        return higher + 1


# ======================================================
# USER PROFILE SERIALIZER (/api/profile/, leaderboard, online players)
# ======================================================

class UserProfileSerializer(serializers.ModelSerializer):
    rating = serializers.SerializerMethodField()
    rank = serializers.SerializerMethodField()
    global_rank = serializers.SerializerMethodField()

    preferred_language = serializers.SerializerMethodField()
    preferred_difficulty = serializers.SerializerMethodField()

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
        )

    # ------------------------
    # SAFE GETTERS
    # ------------------------

    def _get_profile(self, obj):
        try:
            profile = obj.userprofile
            profile.refresh_from_db()   # 🔥 FIX CACHE HERE
            return profile
        except UserProfile.DoesNotExist:
            return None

    def get_rating(self, obj):
        profile = self._get_profile(obj)
        return profile.rating if profile else 0

    def get_rank(self, obj):
        profile = self._get_profile(obj)
        return profile.rank if profile else "Bronze"

    def get_global_rank(self, obj):
        profile = self._get_profile(obj)
        if not profile:
            return None
        higher = UserProfile.objects.filter(rating__gt=profile.rating).count()
        return higher + 1

    def get_preferred_language(self, obj):
        profile = self._get_profile(obj)
        return profile.preferred_language if profile else "cpp"

    def get_preferred_difficulty(self, obj):
        profile = self._get_profile(obj)
        return profile.preferred_difficulty if profile else "easy"
