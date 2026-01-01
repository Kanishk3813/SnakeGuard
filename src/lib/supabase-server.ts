import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from './supabaseAdmin';

/**
 * Get the current user session from cookies in API routes
 * Tries multiple cookie formats that Supabase might use
 */
export async function getServerSession() {
  const cookieStore = await cookies();
  const supabaseAdmin = getSupabaseAdminClient();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  
  if (!supabaseUrl) {
    return null;
  }

  // Extract project ref from URL
  const projectRef = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1];
  
  // Try different cookie names that Supabase might use
  const possibleCookieNames = [
    `sb-${projectRef}-auth-token`,
    `sb-${projectRef}-auth-token-code-verifier`,
    `sb-${projectRef}-auth-token.0`,
    `sb-${projectRef}-auth-token.1`,
  ];

  let accessToken: string | null = null;

  // Try to find the access token in any of the cookies
  for (const cookieName of possibleCookieNames) {
    const cookie = cookieStore.get(cookieName);
    if (cookie?.value) {
      try {
        const tokenData = JSON.parse(cookie.value);
        if (tokenData?.access_token) {
          accessToken = tokenData.access_token;
          break;
        }
      } catch {
        // Not JSON, try next cookie
        continue;
      }
    }
  }

  // If we found an access token, verify it
  if (accessToken) {
    try {
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken);
      if (!error && user) {
        return { user, accessToken };
      }
    } catch {
      // Token invalid, continue to try other methods
    }
  }

  // Alternative: Check all cookies for any that might contain a token
  // Supabase might store tokens in different formats
  const allCookies = cookieStore.getAll();
  for (const cookie of allCookies) {
    if (cookie.name.includes('auth') || cookie.name.includes('token')) {
      try {
        const parsed = JSON.parse(cookie.value);
        if (parsed?.access_token) {
          const { data: { user }, error } = await supabaseAdmin.auth.getUser(parsed.access_token);
          if (!error && user) {
            return { user, accessToken: parsed.access_token };
          }
        }
      } catch {
        // Not JSON or not a token, continue
      }
    }
  }

  return null;
}

