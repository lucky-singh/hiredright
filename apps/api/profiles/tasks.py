import logging
import json
import os
from celery import shared_task
from django.core.files.storage import default_storage
from profiles.models import CandidateProfile, ActivityClaim, Proficiency
from taxonomy.models import Activity, Function
from pypdf import PdfReader
from google import genai

logger = logging.getLogger(__name__)

def extract_text_from_pdf(file_obj) -> str:
    reader = PdfReader(file_obj)
    text = ""
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            text += page_text + "\n"
    return text

@shared_task
def parse_resume_task(profile_id: int, function_code: str = None):
    try:
        profile = CandidateProfile.objects.get(pk=profile_id)
        if not profile.resume:
            logger.warning(f"Profile {profile_id} has no resume attached.")
            return
        
        logger.info(f"Starting resume processing for profile {profile_id}: {profile.resume.name}")
        
        # 1. Read PDF from storage
        with profile.resume.open('rb') as f:
            resume_text = extract_text_from_pdf(f)

        # 2. Get scorable activities (filter by function if provided)
        qs = Activity.objects.filter(is_active=True)
        if function_code:
            qs = qs.filter(competency_areas__function__code=function_code)
            
        activities = qs.values("code", "label")
        activities_list = [{"code": a["code"], "label": a["label"]} for a in activities]
        
        if not activities_list:
            logger.warning(f"No activities found to match against (function_code: {function_code}).")
            return
        
        # 3. Call LLM
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            logger.warning("GEMINI_API_KEY not set. Simulating parsing success but no claims created.")
            return
            
        client = genai.Client(api_key=api_key)
        
        prompt = (
            "You are an expert recruitment AI. You are given a candidate's resume text "
            "and a JSON list of available 'Activity' codes and labels. "
            "Your job is to match the candidate's experience against these activities. "
            "Return a JSON object with a single key 'codes' containing an array of strings "
            "representing the 'code's of the activities that the candidate has explicitly performed. "
            "Do not include activities they haven't done.\n\n"
            f"Available Activities:\n{json.dumps(activities_list)}\n\n"
            f"Resume Text:\n{resume_text}"
        )
        
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config={'response_mime_type': 'application/json'}
        )
        
        content = response.text
        try:
            data = json.loads(content)
            if isinstance(data, dict):
                matched_codes = data.get("codes", []) or list(data.values())[0]
            elif isinstance(data, list):
                matched_codes = data
            else:
                matched_codes = []
        except:
            matched_codes = []
            
        if not matched_codes:
            logger.info("No matching activities found by LLM.")
            return
            
        # 4. Save ActivityClaims
        valid_activities = Activity.objects.filter(code__in=matched_codes, is_active=True)
        created_count = 0
        for activity in valid_activities:
            claim, created = ActivityClaim.objects.get_or_create(
                profile=profile,
                activity=activity,
                defaults={"proficiency": Proficiency.WORKING, "is_ai_inferred": True}
            )
            if created:
                created_count += 1
                
        logger.info(f"Successfully processed resume for profile {profile_id} (function: {function_code}). Created {created_count} claims.")
        
    except Exception as e:
        logger.error(f"Failed to process resume for profile {profile_id}: {e}")
        raise
