import pytest
from django.test import override_settings

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from django.core.files.uploadedfile import SimpleUploadedFile
from unittest.mock import patch, MagicMock
from taxonomy.models import Role

@override_settings(STORAGES={'default': {'BACKEND': 'django.core.files.storage.InMemoryStorage'}})
@pytest.mark.django_db
def test_resume_upload_view(api_client, candidate):
    url = reverse("resume-upload")
    
    api_client.force_authenticate(user=candidate)
    
    # 1. Test GET
    res = api_client.get(url)
    assert res.status_code == status.HTTP_200_OK
    
    # 2. Test POST without file
    res = api_client.post(url, {})
    assert res.status_code == status.HTTP_400_BAD_REQUEST

    # 3. Test POST with file
    pdf_content = b"%PDF-1.4 dummy content"
    resume_file = SimpleUploadedFile("test.pdf", pdf_content, content_type="application/pdf")
    role = Role.objects.create(code="test-func", label="Test Func")
    
    with patch('profiles.tasks.parse_resume_task.delay') as mock_task:
        mock_task.return_value = MagicMock(id="test-task-123")
        res = api_client.post(url, {"resume": resume_file, "roleCode": "test-func"}, format="multipart")
        assert res.status_code == status.HTTP_202_ACCEPTED
        assert "processing started" in res.data["detail"]
        assert res.data["task_id"] == "test-task-123"
        mock_task.assert_called_once()
        
        # Verify CandidateResume was created with correct name pattern
        from profiles.models import CandidateResume
        resumes = CandidateResume.objects.filter(profile__user=candidate, role=role)
        assert resumes.exists()
        resume_obj = resumes.first()
        assert "test-func_Resume.pdf" in resume_obj.file.name

@pytest.mark.django_db
def test_resume_task_status_view(api_client, candidate):
    url = reverse("resume-status", args=["test-task-123"])
    
    # Unauthenticated should fail
    res = api_client.get(url)
    assert res.status_code == status.HTTP_401_UNAUTHORIZED
    
    api_client.force_authenticate(user=candidate)
    
    with patch('api.v1.views.AsyncResult') as mock_result:
        mock_result.return_value.status = 'SUCCESS'
        mock_result.return_value.result = 'Dummy success result'
        
        res = api_client.get(url)
        assert res.status_code == status.HTTP_200_OK
        assert res.data["task_id"] == "test-task-123"
        assert res.data["status"] == "SUCCESS"
        assert res.data["result"] == "Dummy success result"
