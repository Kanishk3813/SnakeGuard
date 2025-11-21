import { NextRequest } from 'next/server';
import { getSupabaseAdminClient } from './supabaseAdmin';

const ADMIN_BEARER_PREFIX = 'bearer ';

export async function requireAdminUser(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdminClient();
  const authHeader = request.headers.get('authorization') || '';
  const token = extractBearerToken(authHeader);

  if (!token) {
    throw new Error('Unauthorized');
  }

  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(token);

  if (userError || !user) {
    throw new Error('Unauthorized');
  }

  const { data: adminRecord, error: adminError } = await supabaseAdmin
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (adminError || !adminRecord) {
    throw new Error('Forbidden');
  }

  return user;
}

function extractBearerToken(headerValue: string) {
  if (!headerValue) return null;
  if (headerValue.toLowerCase().startsWith(ADMIN_BEARER_PREFIX)) {
    return headerValue.slice(ADMIN_BEARER_PREFIX.length).trim();
  }
  return null;
}

