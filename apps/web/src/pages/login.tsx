import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { loginUser } from '@/lib/api/auth';
import { Loader2, Eye, EyeOff } from 'lucide-react';

export function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const responseData = await loginUser({
        email: formData.email,
        password: formData.password,
      });
      // Redirect to builder or search
      if (responseData.user?.is_recruiter) {
        navigate('/search');
      } else {
        navigate('/profile');
      }
    } catch (err: any) {
      console.error(err);
      if (err.body) {
        // Simple error formatter for drf errors
        const msg = Object.entries(err.body).map(([k, v]) => `${k}: ${v}`).join(', ');
        setError(msg);
      } else {
        setError(err.message || 'Login failed');
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
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-white"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Welcome back
          </CardTitle>
          <CardDescription className="text-zinc-500 dark:text-zinc-400">
            Enter your credentials to access your HireRight profile.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div role="alert" className="p-3 text-sm font-medium text-red-800 bg-red-100 rounded-lg dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-900/50">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-zinc-900 dark:text-zinc-300">Email</Label>
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
            <div className="space-y-2">
              <Label htmlFor="password" className="text-zinc-900 dark:text-zinc-300">Password</Label>
              <Input 
                id="password" 
                name="password" 
                type={showPassword ? 'text' : 'password'} 
                required 
                value={formData.password}
                onChange={handleChange}
                autoComplete="current-password"
                className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 dark:text-zinc-100"
              />
              <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(v => !v)} className="mt-1 inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded">
                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />} {showPassword ? 'Hide password' : 'Show password'}
              </button>
            </div>
            <button 
              type="submit" 
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-2.5 px-4 mt-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? "Logging in..." : "Log in"}
            </button>
          </form>
          <p className="mt-4 text-center text-sm"><Link to="/forgot-password" className="text-blue-600 hover:underline">Forgot password?</Link></p>
        </CardContent>
        <CardFooter className="flex justify-center border-t border-zinc-100 dark:border-zinc-800 pt-6">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Don't have an account?{' '}
            <Link to="/signup" className="font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400">
              Sign up
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
