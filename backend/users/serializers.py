import logging # Thêm logging
from rest_framework import serializers
from django.contrib.auth.models import User
# Thêm import cho validate_password
from django.contrib.auth.password_validation import validate_password
from .models import UserProfile, UserStats, UserActivityLog # Thêm UserActivityLog
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

# Khởi tạo logger
logger = logging.getLogger(__name__)

# ===================================================================
# Serializers cho Xác thực (Authentication)
# ===================================================================

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
            # Lấy profile hoặc tạo mới nếu chưa có
            profile, created = UserProfile.objects.get_or_create(user=self.user)
            
            # Cập nhật trạng thái online
            if not profile.is_online:
                profile.is_online = True
                profile.save(update_fields=['is_online'])
            
            # Ghi log (luôn luôn)
            UserActivityLog.objects.create(user=self.user, activity_type='login')
            
        except Exception as e:
            # Ghi log lỗi thay vì print
            logger.error(f"Lỗi khi cập nhật trạng thái/ghi log (user: {self.user.username}): {e}")
            
        return data

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
            raise serializers.ValidationError({"password": "Mật khẩu không khớp."})
        
        # NOTE: Việc kiểm tra 2 query riêng biệt như này là TỐT cho UX
        # vì nó báo lỗi chính xác field nào bị trùng.
        if User.objects.filter(email=attrs['email']).exists():
            raise serializers.ValidationError({"email": "Email này đã được sử dụng."})
        if User.objects.filter(username=attrs['username']).exists():
            raise serializers.ValidationError({"username": "Username này đã được sử dụng."})
        
        return attrs

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password']
        )
        return user

# ===================================================================
# Serializers cho Dữ liệu User (Profile & Stats)
# ===================================================================

class UserStatsSerializer(serializers.ModelSerializer):
    
    win_rate = serializers.IntegerField(read_only=True)
    global_rank = serializers.SerializerMethodField()

    class Meta:
        model = UserStats
        fields = ('total_battles', 'win_rate', 'current_streak', 'global_rank')

    def get_global_rank(self, obj):
        
        try:
            # obj ở đây là 1 instance UserStats
            user_rating = obj.user.userprofile.rating
            if user_rating is None:
                return None
            higher_rank_count = UserProfile.objects.filter(rating__gt=user_rating).count()
            return higher_rank_count + 1
        except (UserProfile.DoesNotExist, AttributeError):
            return None

class UserProfileSerializer(serializers.ModelSerializer):
    
    # source='userprofile.rating' sẽ tự động join User -> UserProfile
    # (cần .select_related('userprofile') trong ViewSet để tối ưu)
    rating = serializers.IntegerField(source='userprofile.rating', read_only=True, default=0)
    global_rank = serializers.SerializerMethodField()
    rank = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'username', 'rating', 'global_rank', 'rank')

    def get_global_rank(self, obj):
        
        try:
            # obj ở đây là 1 instance User
            user_rating = obj.userprofile.rating
            if user_rating is None:
                return None
            higher_rank_count = UserProfile.objects.filter(rating__gt=user_rating).count()
            return higher_rank_count + 1
        except (UserProfile.DoesNotExist, AttributeError):
            return None
    
    def get_rank(self, obj):
        
        try:
            # obj ở đây là 1 instance User
            rating = obj.userprofile.rating or 0 # An toàn hơn nếu rating là None
        except (UserProfile.DoesNotExist, AttributeError):
            rating = 0 # Mặc định là 0 nếu chưa có profile
        
        if rating <= 1000:
            return "Bronze"
        elif rating <= 2000:
            return "Silver"
        elif rating <= 3000: # Thêm khoảng 2001-3000
            return "Gold"
        else: # Trên 3000
            return "Platinum" # (Ví dụ)