import { ApiError } from './client';

export interface RegisterResponse {
  key?: string; 
  access?: string;
  access_token?: string;
  user?: {
    pk: number;
    email: string;
    first_name: string;
    last_name: string;
    is_recruiter: boolean;
  };
}

export async function registerUser(data: any): Promise<RegisterResponse> {
  const res = await fetch('/api/v1/auth/registration/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body);
  }

  const responseData = await res.json();
  const token = responseData.access || responseData.access_token || responseData.key;
  if (token) localStorage.setItem('access_token', token);
  if (responseData.user) localStorage.setItem('user', JSON.stringify(responseData.user));
  
  return responseData;
}

export async function loginUser(data: any): Promise<RegisterResponse> {
  const res = await fetch('/api/v1/auth/login/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body);
  }

  const responseData = await res.json();
  const token = responseData.access || responseData.access_token || responseData.key;
  if (token) localStorage.setItem('access_token', token);
  if (responseData.user) localStorage.setItem('user', JSON.stringify(responseData.user));
  
  return responseData;
}

export async function logoutUser(): Promise<void> {
  // Optional: Call the backend logout endpoint to blacklist tokens
  try {
    const token = localStorage.getItem('access_token');
    if (token) {
      await fetch('/api/v1/auth/logout/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      });
    }
  } catch (err) {
    console.error('Failed to call logout endpoint', err);
  }
  // Always clear local storage
  localStorage.removeItem('access_token');
  localStorage.removeItem('user');
}

export async function requestPasswordReset(email: string): Promise<void> {
  const res = await fetch('/api/v1/auth/password/reset/', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
}

export async function confirmPasswordReset(data: { uid: string; token: string; new_password1: string; new_password2: string }): Promise<void> {
  const res = await fetch('/api/v1/auth/password/reset/confirm/', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  });
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
}
