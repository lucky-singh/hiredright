import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchFunctions } from '@/lib/api/builder';
import type { JobFunction } from '@/lib/api/types';
import { Loader2, Upload, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { UserMenu } from '@/components/user-menu';

type Step = 'select' | 'prompt' | 'uploading' | 'processing' | 'summary' | 'error';

export function FunctionSelectionPage() {
  const [functions, setFunctions] = useState<JobFunction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('select');
  const [selectedFunction, setSelectedFunction] = useState<JobFunction | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchFunctions()
      .then((data) => {
        setFunctions(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (step === 'processing' && taskId) {
      interval = setInterval(async () => {
        try {
          const token = localStorage.getItem('access_token');
          const res = await fetch(`/api/v1/profile/resume/status/${taskId}/`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();
          if (data.status === 'SUCCESS') {
            setStep('summary');
          } else if (data.status === 'FAILURE') {
            setError(data.result || 'Task failed');
            setStep('error');
          }
        } catch (e) {
          console.error('Polling error', e);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [step, taskId]);

  const handleSelect = (func: JobFunction) => {
    setSelectedFunction(func);
    setStep('prompt');
  };

  const handleSkip = () => {
    if (selectedFunction) {
      navigate(`/builder/${selectedFunction.code}`);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !selectedFunction) return;
    
    setStep('uploading');
    const formData = new FormData();
    formData.append('resume', e.target.files[0]);
    formData.append('functionCode', selectedFunction.code);

    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch('/api/v1/profile/resume/', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      setTaskId(data.task_id);
      setStep('processing');
    } catch (err: any) {
      setError(err.message);
      setStep('error');
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error && step === 'select') {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <h2 className="text-xl font-bold text-red-600 mb-2">Failed to load functions</h2>
        <p className="text-zinc-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 relative">
      <UserMenu />
      <div className="max-w-3xl w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {step === 'select' && (
          <>
            <div>
              <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                Select Your Role
              </h2>
              <p className="mt-2 text-center text-sm text-zinc-600 dark:text-zinc-400 mb-8">
                Choose the function you want to build your profile for.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {functions.map((func) => (
                <button
                  key={func.code}
                  onClick={() => handleSelect(func)}
                  className="relative rounded-lg border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 py-5 shadow-sm flex items-center space-x-3 hover:border-blue-500 hover:ring-1 hover:ring-blue-500 focus:outline-none transition-all text-left"
                >
                  <div className="flex-1 min-w-0">
                    <span className="absolute inset-0" aria-hidden="true" />
                    <p className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
                      {func.label}
                    </p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">
                      {func.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 'prompt' && selectedFunction && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-8 max-w-2xl mx-auto shadow-sm text-center">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-600 dark:text-blue-400">
              <FileText className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-3">
              Auto-fill your {selectedFunction.label} profile
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400 mb-8 max-w-lg mx-auto leading-relaxed">
              Upload your PDF resume and our Gemini AI will analyze your background and instantly map it to the precise skills required for this function.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={handleSkip}
                className="px-6 py-3 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors w-full sm:w-auto"
              >
                Skip & do it manually
              </button>
              <label className="relative flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-600 px-8 py-3 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none transition-colors w-full sm:w-auto shadow-sm">
                <Upload className="w-4 h-4" />
                Upload Resume PDF
                <input type="file" className="sr-only" accept=".pdf" onChange={handleFileUpload} />
              </label>
            </div>
          </div>
        )}

        {(step === 'uploading' || step === 'processing') && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-12 max-w-lg mx-auto shadow-sm text-center">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-6" />
            <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
              {step === 'uploading' ? 'Uploading PDF...' : 'AI is analyzing your resume...'}
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400 text-sm">
              This usually takes 20-40 seconds. We are actively extracting your skills and updating your profile.
            </p>
          </div>
        )}

        {step === 'summary' && (
          <div className="bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-900/50 rounded-xl p-12 max-w-2xl mx-auto shadow-sm text-center">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-3">
              Resume Analysis Complete!
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400 mb-8 max-w-lg mx-auto">
              Our AI successfully processed your background and identified matching skills. Please proceed to the builder to review them and make any necessary updates.
            </p>
            <button
              onClick={handleSkip}
              className="px-8 py-3 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
            >
              Review My Profile
            </button>
          </div>
        )}

        {step === 'error' && (
          <div className="bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-900/50 rounded-xl p-12 max-w-2xl mx-auto shadow-sm text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600 dark:text-red-400">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-3">
              Something went wrong
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400 mb-8 max-w-lg mx-auto">
              {error}
            </p>
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => setStep('prompt')}
                className="px-6 py-2 rounded-lg text-sm font-medium border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={handleSkip}
                className="px-6 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
              >
                Skip & do it manually
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
