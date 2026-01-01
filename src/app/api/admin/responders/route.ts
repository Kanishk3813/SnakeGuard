import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { getServerSession } from '@/lib/supabase-server';

/**
 * Get user from request (tries cookies first, then Authorization header)
 */
async function getUserFromRequest(request: NextRequest) {
  // Try Authorization header first (more reliable)
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const supabaseAdmin = getSupabaseAdminClient();
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (!error && user) {
      return user;
    }
    console.error('Error verifying token from Authorization header:', error);
  }

  // Try cookies as fallback
  const session = await getServerSession();
  if (session) {
    return session.user;
  }

  console.error('No valid session found in cookies or Authorization header');
  return null;
}

/**
 * GET /api/admin/responders
 * Get all responders or check if a user is a responder
 * - If checking specific user_id: Any authenticated user can check their own status, or admins can check anyone
 * - If getting all responders: Admin only
 */
export async function GET(request: NextRequest) {
  try {
    // Get user from request
    const user = await getUserFromRequest(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabaseAdmin = getSupabaseAdminClient();
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('user_id');

    // If checking specific user_id
    if (userId) {
      // Allow users to check their own status, or admins to check anyone
      const isCheckingSelf = user.id === userId;
      
      if (!isCheckingSelf) {
        // If checking someone else, verify admin access
        const { data: adminRecord } = await supabaseAdmin
          .from('admin_users')
          .select('user_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!adminRecord) {
          return NextResponse.json(
            { error: 'Forbidden - Can only check your own status or admin access required' },
            { status: 403 }
          );
        }
      }

      // Check if specific user is a responder
      const { data: profile, error } = await supabaseAdmin
        .from('user_profiles')
        .select('user_id, is_responder, full_name')
        .eq('user_id', userId)
        .single();

      if (error) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        is_responder: profile?.is_responder || false,
        user: profile
      });
    }

    // Getting all responders - admin only
    const { data: adminRecord } = await supabaseAdmin
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!adminRecord) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    // Get all responders
    const { data: responders, error } = await supabaseAdmin
      .from('user_profiles')
      .select('user_id, full_name, email_verified, phone_verified, created_at, is_responder')
      .eq('is_responder', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    // Get emails from auth users
    const { data: { users: authUsers } } = await supabaseAdmin.auth.admin.listUsers();
    const respondersWithEmail = (responders || []).map(responder => {
      const authUser = authUsers?.find(u => u.id === responder.user_id);
      return {
        ...responder,
        email: authUser?.email || null
      };
    });

    return NextResponse.json({
      success: true,
      responders: respondersWithEmail,
      count: respondersWithEmail.length
    });

  } catch (error: any) {
    console.error('Error fetching responders:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/responders
 * Add or remove responder status for a user
 */
export async function POST(request: NextRequest) {
  try {
    // Get user from request
    const user = await getUserFromRequest(request);
    
    if (!user) {
      console.error('No user found in request - check cookies or Authorization header');
      return NextResponse.json(
        { error: 'Unauthorized - No valid session found' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const supabaseAdmin = getSupabaseAdminClient();
    const { data: adminRecord } = await supabaseAdmin
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!adminRecord) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { userId, isResponder } = body;

    if (!userId || typeof isResponder !== 'boolean') {
      return NextResponse.json(
        { error: 'userId and isResponder (boolean) are required' },
        { status: 400 }
      );
    }

    console.log('Updating responder status for userId:', userId, 'isResponder:', isResponder);

    // Check if target user exists
    const { data: targetUser, error: userError } = await supabaseAdmin
      .from('user_profiles')
      .select('user_id, full_name, is_responder')
      .eq('user_id', userId)
      .single();

    if (userError) {
      console.error('Error fetching target user:', userError);
      return NextResponse.json(
        { error: 'Target user not found', details: userError.message, userId },
        { status: 404 }
      );
    }

    if (!targetUser) {
      console.error('Target user not found in database:', userId);
      return NextResponse.json(
        { error: 'Target user not found in database', userId },
        { status: 404 }
      );
    }

    console.log('Target user found:', targetUser);

    // Update responder status
    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('user_profiles')
      .update({ is_responder: isResponder })
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // Get email for response
    const { data: { user: authUser } } = await supabaseAdmin.auth.admin.getUserById(userId);

    return NextResponse.json({
      success: true,
      message: isResponder 
        ? 'User granted responder status' 
        : 'User responder status removed',
      user: {
        ...updatedUser,
        email: authUser?.email || null
      }
    });

  } catch (error: any) {
    console.error('Error updating responder status:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

