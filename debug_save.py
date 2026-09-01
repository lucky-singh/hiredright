import re

with open('apps/api/api/v1/serializers.py', 'r') as f:
    content = f.read()

new_serializer = """class CustomRegisterSerializer(RegisterSerializer):
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)
    phone_number = serializers.CharField(required=False, allow_blank=True)

    def save(self, request):
        print("DEBUG SAVE CALLED. validated_data:", self.validated_data)
        user = super().save(request)
        user.first_name = self.validated_data.get('first_name', '')
        user.last_name = self.validated_data.get('last_name', '')
        user.phone_number = self.validated_data.get('phone_number', '')
        user.save()
        print("DEBUG SAVED USER", user.first_name, user.last_name, user.phone_number)
        return user
"""

content = re.sub(
    r"class CustomRegisterSerializer\(RegisterSerializer\):.*?(?=\n\Z|\n\n\n|\Z)", 
    new_serializer, 
    content, 
    flags=re.DOTALL
)

with open('apps/api/api/v1/serializers.py', 'w') as f:
    f.write(content)
