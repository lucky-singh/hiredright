import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from django.core.files.uploadedfile import SimpleUploadedFile
from unittest.mock import patch
from taxonomy.models import Function

@pytest.mark.django_db
def test_resume_upload_view(api_client, candidate):
    url = reverse("resume-upload")
    
    # 1. Test GET
    res = api_client.get(url)
    assert res.status_code == status.HTTP_200_OK
    
    # 2. Test POST without file
    api_client.force_authenticate(user=candidate)
    res = api_client.post(url, {})
    assert res.status_code == status.HTTP_400_BAD_REQUEST

    # 3. Test POST with file
    pdf_content = b"%PDF-1.4 dummy content"
    resume_file = SimpleUploadedFile("test.pdf", pdf_content, content_type="application/pdf")
    
    with patch('profiles.tasks.parse_resume_task.delay') as mock_task:
        res = api_client.post(url, {"resume": resume_file, "functionCode": "test-func"}, format="multipart")
        assert res.status_code == status.HTTP_202_ACCEPTED
        assert "processing started" in res.data["detail"]
        mock_task.assert_called_once()
