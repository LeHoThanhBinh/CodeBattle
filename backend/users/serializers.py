from rest_framework import serializers
from django.contrib.auth.models import User
from .models import UserProfile, UserStats
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth.password_validation import validate_password


# --- Serializer cho việc đăng nhập (không thay đổi) ---
class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['username'] = user.username
        token['is_admin'] = user.is_staff or user.is_superuser
        return token

# --- Serializer cho việc đăng ký (không thay đổi) ---
class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True, required=True, validators=[validate_password]
    )
    password2 = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'password2')

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({"password": "Password fields didn't match."})
        if User.objects.filter(email=attrs['email']).exists():
            raise serializers.ValidationError({"email": "An account with this email already exists."})
        if User.objects.filter(username=attrs['username']).exists():
            raise serializers.ValidationError({"username": "An account with this username already exists."})
        return attrs

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password']
        )
        return user


# --- SERIALIZER MỚI: Dành cho các thẻ thống kê trên Dashboard ---
class UserStatsSerializer(serializers.ModelSerializer):
    # Thêm trường win_rate (là một @property trong model)
    win_rate = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = UserStats
        fields = ('total_battles', 'wins', 'current_streak', 'win_rate')


# --- UserProfileSerializer được cập nhật ---
# Dùng để lấy thông tin cho header, danh sách online và bảng xếp hạng
class UserProfileSerializer(serializers.ModelSerializer):
    rating = serializers.IntegerField(source='userprofile.rating', read_only=True)
    # Thêm global_rank để gộp vào API profile, giúp frontend không cần tính toán
    global_rank = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'username', 'rating', 'global_rank')

    def get_global_rank(self, obj):
        """
        Tính toán thứ hạng của người dùng dựa trên ELO.
        Đếm số người dùng có rating cao hơn người dùng hiện tại và cộng thêm 1.
        """
        try:
            user_rating = obj.userprofile.rating
            higher_rank_count = UserProfile.objects.filter(rating__gt=user_rating).count()
            return higher_rank_count + 1
        except UserProfile.DoesNotExist:
            return None

