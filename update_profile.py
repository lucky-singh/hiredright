import re

with open("apps/web/src/pages/candidate-profile.tsx", "r") as f:
    content = f.read()

# 1. Add phone_number to ProfileData
content = content.replace(
    "  last_name: string;",
    "  last_name: string;\n  phone_number?: string;"
)

# 2. Add state
state_code = """
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', phone_number: '' });
  const [savingProfile, setSavingProfile] = useState(false);
"""
content = content.replace(
    "const navigate = useNavigate();",
    "const navigate = useNavigate();\n" + state_code
)

# 3. Update setEditForm on fetch
fetch_code = """        setProfile(data);
        setEditForm({
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          phone_number: data.phone_number || '',
        });"""
content = content.replace("        setProfile(data);", fetch_code)

# 4. Add handleSaveProfile
save_func = """
  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch('/api/v1/auth/user/', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editForm)
      });
      if (!res.ok) throw new Error('Failed to update profile');
      const data = await res.json();
      setProfile(prev => prev ? { ...prev, ...data } : null);
      setIsEditing(false);
      
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        localStorage.setItem('user', JSON.stringify({ ...user, ...data }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingProfile(false);
    }
  };
"""
content = content.replace(
    "  if (loading) {",
    save_func + "\n  if (loading) {"
)

# 5. UI changes
ui_code = """
            <div className="flex-1 w-full sm:w-auto">
              {isEditing ? (
                <div className="space-y-3 mt-2 w-full max-w-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <input 
                      type="text" 
                      placeholder="First Name" 
                      className="px-3 py-2 border rounded-md text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-white w-full"
                      value={editForm.first_name}
                      onChange={(e) => setEditForm({...editForm, first_name: e.target.value})}
                    />
                    <input 
                      type="text" 
                      placeholder="Last Name" 
                      className="px-3 py-2 border rounded-md text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-white w-full"
                      value={editForm.last_name}
                      onChange={(e) => setEditForm({...editForm, last_name: e.target.value})}
                    />
                  </div>
                  <input 
                    type="text" 
                    placeholder="Phone Number" 
                    className="w-full px-3 py-2 border rounded-md text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                    value={editForm.phone_number}
                    onChange={(e) => setEditForm({...editForm, phone_number: e.target.value})}
                  />
                  <div className="flex gap-2">
                    <button onClick={handleSaveProfile} disabled={savingProfile} className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700">
                      {savingProfile ? 'Saving...' : 'Save'}
                    </button>
                    <button onClick={() => setIsEditing(false)} disabled={savingProfile} className="px-3 py-1.5 bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 rounded text-sm font-medium hover:bg-zinc-300 dark:hover:bg-zinc-700">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                      {profile.first_name ? `${profile.first_name} ${profile.last_name}` : 'Your Profile'}
                    </h1>
                    <button onClick={() => setIsEditing(true)} className="text-sm text-blue-600 hover:text-blue-700 px-2 py-1 bg-blue-50 dark:bg-blue-900/30 rounded font-medium">
                      Edit
                    </button>
                  </div>
                  <p className="mt-1 text-zinc-600 dark:text-zinc-400">{profile.email}</p>
                  {profile.phone_number && <p className="mt-1 text-zinc-500 dark:text-zinc-400 text-sm font-medium">📞 {profile.phone_number}</p>}
                </>
              )}
              {!isEditing && profile.is_recruiter && (
"""

content = re.sub(
    r'<div>\s*<h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">\s*\{profile\.first_name \? `\$\{profile\.first_name\} \$\{profile\.last_name\}` : \'Your Profile\'\}\s*</h1>\s*<p className="mt-1 text-zinc-600 dark:text-zinc-400">\{profile\.email\}</p>\s*\{profile\.is_recruiter && \(',
    ui_code,
    content,
    flags=re.MULTILINE
)

with open("apps/web/src/pages/candidate-profile.tsx", "w") as f:
    f.write(content)
