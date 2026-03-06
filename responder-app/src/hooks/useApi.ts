import { supabase } from '@/lib/supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

export async function apiGet<T = any>(path: string): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}${path}`, { headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.details || body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export async function apiPost<T = any>(path: string, body?: any): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.details || data.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export async function apiPatch<T = any>(path: string, body?: any): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}${path}`, {
    method: 'PATCH',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.details || data.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export async function apiDelete<T = any>(path: string): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}${path}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.details || data.error || `Request failed: ${res.status}`);
  }
  return res.json();
}
