from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework import generics, status
from rest_framework.response import Response
from django.contrib.auth.models import User
# --- ĐÃ SỬA LỖI: Bổ sung các import còn thiếu ---
from .serializers import MyTokenObtainPairSerializer, RegisterSerializer, UserProfileSerializer
from rest_framework.permissions import AllowAny, IsAuthenticated

# View cho việc đăng nhập (lấy token)
class MyTokenObtainPairView(TokenObtainPairView):
    serializer_class = MyTokenObtainPairSerializer

    # --- BẮT ĐẦU ĐOẠN CODE GỠ LỖI ---
    def post(self, request, *args, **kwargs):
        """
        Ghi đè phương thức post để in ra dữ liệu nhận được trước khi xử lý.
        """
        print("==============================================")
        print(">>> BACKEND NHẬN ĐƯỢC YÊU CẦU ĐĂNG NHẬP <<<")
        print(f"Dữ liệu nhận được (raw): {request.data}")
        print("==============================================")
        
        # Chạy logic đăng nhập gốc của thư viện
        try:
            response = super().post(request, *args, **kwargs)
            if response.status_code == 200:
                print("--- KẾT QUẢ: XÁC THỰC THÀNH CÔNG (Mật khẩu đúng) ---")
            else:
                # Trường hợp này ít xảy ra, nhưng vẫn log lại
                print(f"--- KẾT QUẢ: XÁC THỰC THẤT BẠI (Mã lỗi: {response.status_code}) ---")
            return response
        except Exception as e:
            print(f"--- KẾT QUẢ: XÁC THỰC THẤT BẠI - Lỗi: {e} ---")
            # Trả về lỗi 401 Unauthorized mặc định
            return Response(
                {"detail": "No active account found with the given credentials"},
                status=status.HTTP_401_UNAUTHORIZED
            )
    # --- KẾT THÚC ĐOẠN CODE GỠ LỖI ---

# View cho việc đăng ký tài khoản mới
class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (AllowAny,)
    serializer_class = RegisterSerializer

# View này xử lý yêu cầu lấy thông tin profile của người dùng đang đăng nhập
class UserProfileView(generics.RetrieveAPIView):
    queryset = User.objects.all()
    serializer_class = UserProfileSerializer   # <<< Giờ đã hợp lệ
    permission_classes = [IsAuthenticated] # <<< Giờ đã hợp lệ

    def get_object(self):
        # Trả về đối tượng user của chính request đang gửi lên,
        # không cần lấy id từ URL
        return self.request.user

