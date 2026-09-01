import re

with open("apps/api/api/v1/serializers.py", "r") as f:
    content = f.read()

content = re.sub(
    r"from dj_rest_auth\.registration\.serializers import RegisterSerializer\n\nclass CustomRegisterSerializer\(RegisterSerializer\):.*?(?=\n\Z|\n\n\n|\Z)",
    "",
    content,
    flags=re.DOTALL
)

with open("apps/api/api/v1/serializers.py", "w") as f:
    f.write(content.strip() + "\n")
