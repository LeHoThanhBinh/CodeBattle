from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import UserProfile, UserStats, UserActivityLog

class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['username'] = user.username
        token['is_admin'] = user.is_staff or user.is_superuser
        return token
    
    def validate(self, attrs):
        data = super().validate(attrs)
        try:
            profile = self.user.userprofile
            profile.is_online = True
            profile.save()
            UserActivityLog.objects.create(user=self.user, activity_type='login')
        except UserProfile.DoesNotExist:
            UserProfile.objects.create(user=self.user, is_online=True)
            UserActivityLog.objects.create(user=self.user, activity_type='login')
        except Exception as e:
            print(f"Lỗi khi cập nhật trạng thái online hoặc ghi log: {e}")
        return data

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
            raise serializers.ValidationError({"password": "Mật khẩu không khớp."})
        if User.objects.filter(email=attrs['email']).exists():
            raise serializers.ValidationError({"email": "Email này đã được sử dụng."})
        if User.objects.filter(username=attrs['username']).exists():
            raise serializers.ValidationError({"username": "Tên người dùng này đã tồn tại."})
        return attrs

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password']
        )
        return user

class UserStatsSerializer(serializers.ModelSerializer):
    win_rate = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = UserStats
        fields = ('total_battles', 'wins', 'current_streak', 'win_rate')


class UserProfileSerializer(serializers.ModelSerializer):
    rating = serializers.IntegerField(source='userprofile.rating', read_only=True)
    global_rank = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'username', 'rating', 'global_rank')

    def get_global_rank(self, obj):
        """
        Tính toán thứ hạng của người dùng (obj) dựa trên ELO.
        Đếm số người có ELO cao hơn và cộng 1.
        """
        try:
            user_rating = obj.userprofile.rating
            higher_rank_count = UserProfile.objects.filter(rating__gt=user_rating).count()
            return higher_rank_count + 1
        except UserProfile.DoesNotExist:
            return None