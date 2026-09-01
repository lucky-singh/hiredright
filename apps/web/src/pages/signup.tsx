import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { registerUser } from '@/lib/api/auth';
import { Loader2 } from 'lucide-react';

export function SignupPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
    phone_number: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await registerUser({
        email: formData.email,
        password1: formData.password,
        password2: formData.confirmPassword,
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone_number: formData.phone_number,
      });
      // Redirect to builder
      navigate('/functions');
    } catch (err: any) {
      console.error(err);
      if (err.body) {
        const msg = Object.entries(err.body).map(([k, v]) => `${k}: ${v}`).join(', ');
        setError(msg);
      } else {
        setError(err.message || 'Registration failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500 shadow-xl border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900/50">
        <CardHeader className="space-y-2 pb-6">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mb-2 shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-white"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Create an account
          </CardTitle>
          <CardDescription className="text-zinc-500 dark:text-zinc-400">
            Enter your details below to create your HireRight candidate profile.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 text-sm font-medium text-red-800 bg-red-100 rounded-lg dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-900/50">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-zinc-900 dark:text-zinc-300">Email *</Label>
              <Input 
                id="email" 
                name="email" 
                type="email" 
                required 
                placeholder="m.scott@dundermifflin.com"
                value={formData.email}
                onChange={handleChange}
                className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-600"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name" className="text-zinc-900 dark:text-zinc-300">First Name</Label>
                <Input 
                  id="first_name" 
                  name="first_name" 
                  type="text" 
                  placeholder="Optional"
                  value={formData.first_name}
                  onChange={handleChange}
                  className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-600"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name" className="text-zinc-900 dark:text-zinc-300">Last Name</Label>
                <Input 
                  id="last_name" 
                  name="last_name" 
                  type="text" 
                  placeholder="Optional"
                  value={formData.last_name}
                  onChange={handleChange}
                  className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-600"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone_number" className="text-zinc-900 dark:text-zinc-300">Phone Number</Label>
              <Input 
                id="phone_number" 
                name="phone_number" 
                type="tel" 
                placeholder="Optional (e.g. +14155552671)"
                value={formData.phone_number}
                onChange={handleChange}
                className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-600"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-zinc-900 dark:text-zinc-300">Password *</Label>
              <Input 
                id="password" 
                name="password" 
                type="password" 
                required 
                value={formData.password}
                onChange={handleChange}
                className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-zinc-900 dark:text-zinc-300">Confirm Password *</Label>
              <Input 
                id="confirmPassword" 
                name="confirmPassword" 
                type="password" 
                required 
                value={formData.confirmPassword}
                onChange={handleChange}
                className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 dark:text-zinc-100"
              />
            </div>
            <button 
              type="submit" 
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-2.5 px-4 mt-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? "Creating account..." : "Sign up"}
            </button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center border-t border-zinc-100 dark:border-zinc-800 pt-6">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400">
              Log in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
