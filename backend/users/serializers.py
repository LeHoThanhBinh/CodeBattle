from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import UserProfile, UserStats

# ===================================================================
# Serializers cho Xác thực (Authentication)
# ===================================================================

class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Tùy chỉnh token để thêm thông tin username và quyền admin.
    """
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # Thêm các trường tùy chỉnh vào payload của token
        token['username'] = user.username
        token['is_admin'] = user.is_staff or user.is_superuser
        return token

class RegisterSerializer(serializers.ModelSerializer):
    """
    Serializer cho việc đăng ký người dùng mới.
    """
    password = serializers.CharField(
        write_only=True, required=True, validators=[validate_password]
    )
    password2 = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'password2')

    def validate(self, attrs):
        # Kiểm tra mật khẩu có khớp không
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({"password": "Mật khẩu không khớp."})
        # Kiểm tra email hoặc username đã tồn tại chưa
        if User.objects.filter(email=attrs['email']).exists():
            raise serializers.ValidationError({"email": "Email này đã được sử dụng."})
        if User.objects.filter(username=attrs['username']).exists():
            raise serializers.ValidationError({"username": "Tên người dùng này đã tồn tại."})
        return attrs

    def create(self, validated_data):
        # Tạo người dùng mới bằng create_user để hash mật khẩu đúng cách
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password']
        )
        return user

# ===================================================================
# Serializers cho Dữ liệu Trang Dashboard
# ===================================================================

class UserStatsSerializer(serializers.ModelSerializer):
    """
    Serializer cho các thẻ thống kê trên Dashboard.
    """
    # Khai báo rõ ràng để serializer nhận diện thuộc tính @property từ model
    win_rate = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = UserStats
        fields = ('total_battles', 'wins', 'current_streak', 'win_rate')


class UserProfileSerializer(serializers.ModelSerializer):
    """
    Serializer đa năng: Dùng cho header, danh sách online và bảng xếp hạng.
    """
    # Lấy trường 'rating' từ model UserProfile liên quan
    rating = serializers.IntegerField(source='userprofile.rating', read_only=True)
    
    # Tạo một trường động để tính toán thứ hạng toàn cầu
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
            # Chạy một truy vấn để đếm số profile có rating cao hơn
            higher_rank_count = UserProfile.objects.filter(rating__gt=user_rating).count()
            return higher_rank_count + 1
        except UserProfile.DoesNotExist:
            return None