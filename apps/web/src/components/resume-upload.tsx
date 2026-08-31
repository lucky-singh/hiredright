import { useState } from 'react';
import { Upload, Loader2, CheckCircle2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

export function ResumeUpload({ functionCode }: { functionCode: string }) {
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const queryClient = useQueryClient();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    setUploading(true);
    setUploadSuccess(false);
    
    const formData = new FormData();
    formData.append('resume', e.target.files[0]);
    formData.append('functionCode', functionCode);

    try {
      const token = localStorage.getItem('access_token');
      await fetch('/api/v1/profile/resume/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });
      setUploadSuccess(true);
      // Wait a few seconds for celery to process, then refetch
      setTimeout(() => {
         queryClient.invalidateQueries({ queryKey: ['builder-payload', functionCode] });
         window.location.reload(); // Simple brute force to reload claims for this demo
      }, 5000);
    } catch (err) {
      console.error('Failed to upload resume:', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mb-8 p-6 mx-8 mt-6 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/50 rounded-xl flex items-center justify-between">
      <div>
        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">Smart Resume Parsing</h3>
        <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
          Upload your PDF resume. Our Gemini AI will parse your experience and pre-fill this role for you.
        </p>
      </div>
      <div>
        <label className="relative flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:opacity-50">
          {uploading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
          ) : uploadSuccess ? (
            <><CheckCircle2 className="w-4 h-4" /> Processing...</>
          ) : (
            <><Upload className="w-4 h-4" /> Upload PDF</>
          )}
          <input type="file" className="sr-only" accept=".pdf" onChange={handleFileUpload} disabled={uploading || uploadSuccess} />
        </label>
      </div>
    </div>
  );
}
