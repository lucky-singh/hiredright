import re

with open("docs/api_reference.md", "r") as f:
    content = f.read()

auth_append = """
### User Registration

```http
POST /api/v1/auth/registration/
Content-Type: application/json

{
  "email": "user@example.com",
  "password1": "securepass123",
  "password2": "securepass123",
  "first_name": "Michael",
  "last_name": "Scott",
  "phone_number": "+14155552671"
}
```

- `first_name`, `last_name`, and `phone_number` are optional.

### Update Profile

```http
PUT /api/v1/auth/user/
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "first_name": "Michael",
  "last_name": "Scott",
  "phone_number": "+14155552671"
}
```

- Updates the user's base profile details.

### Get Candidate Profile

```http
GET /api/v1/profile/
Authorization: Bearer <access_token>
```
Returns profile data including `email`, `first_name`, `last_name`, `phone_number`, `resume` URL, and `claims`.

"""

content = content.replace("### Recruiter tokens", auth_append + "### Recruiter tokens")

with open("docs/api_reference.md", "w") as f:
    f.write(content)

