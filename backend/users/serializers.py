from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework import serializers
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from .models import UserProfile # Import UserProfile model

class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['username'] = user.username
        token['is_admin'] = user.is_staff or user.is_superuser
        return token

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True, required=True, validators=[validate_password]
    )
    password2 = serializers.CharField(write_only=True, required=True)
    email = serializers.EmailField(required=True)

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
        # Hàm create_user sẽ tự động băm mật khẩu
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password']
        )
        return user

# Serializer này dùng để lấy thông tin chi tiết của người dùng cho trang Dashboard
class UserProfileSerializer(serializers.ModelSerializer):
    # Lấy các trường từ model UserProfile được liên kết
    # thông qua quan hệ one-to-one (source='userprofile.*')
    rating = serializers.IntegerField(source='userprofile.rating', read_only=True)
    avatar = serializers.URLField(source='userprofile.avatar', read_only=True)
    biography = serializers.CharField(source='userprofile.biography', read_only=True)

    class Meta:
        model = User
        # Các trường muốn trả về cho frontend, kết hợp từ User và UserProfile
        fields = ('id', 'username', 'email', 'rating', 'avatar', 'biography')

