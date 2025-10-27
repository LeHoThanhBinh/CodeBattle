from .models import Problem
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework import status
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from .models import Problem
from .serializers import ProblemSerializer

class ProblemListCreateView(generics.ListCreateAPIView):
    queryset = Problem.objects.all()
    serializer_class = ProblemSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAdminUser()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

class ProblemDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Problem.objects.all()
    serializer_class = ProblemSerializer
    permission_classes = [IsAdminUser] 
    lookup_field = 'pk'

@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_get_problems(request):
    try:
        problems = Problem.objects.all()
        data = []
        for problem in problems:
            data.append({
                'id': problem.id, 
                'name': problem.title, 
                'level': problem.difficulty, 
                'question_count': 1, 
                'is_active': problem.is_active
            })
        return Response(data, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['DELETE'])
@permission_classes([IsAdminUser])
def admin_delete_problem(request, problem_id):
    try:
        problem = Problem.objects.get(id=problem_id)
        problem.delete()
        return Response({'message': 'Bộ đề đã được xóa'}, status=status.HTTP_200_OK)
    except Problem.DoesNotExist:
        return Response({'error': 'Không tìm thấy bộ đề'}, status=status.HTTP_404_NOT_FOUND)

@api_view(['PATCH'])
@permission_classes([IsAdminUser])
def admin_update_problem_status(request, problem_id):
    try:
        problem = Problem.objects.get(id=problem_id)
        is_active = request.data.get('is_active')
        problem.is_active = is_active 
        problem.save()
        return Response({'message': 'Cập nhật thành công'}, status=status.HTTP_200_OK)
    except Problem.DoesNotExist:
        return Response({'error': 'Không tìm thấy bộ đề'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
