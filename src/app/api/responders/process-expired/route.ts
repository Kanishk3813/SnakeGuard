import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { getServerSession } from '@/lib/supabase-server';
import { moveToNextResponder } from '@/lib/responder-assignment';

/**
 * POST /api/responders/process-expired
 * Process expired assignment requests and move to next responder
 * This is called on-demand when responders page loads
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication - responders can trigger this
    const session = await getServerSession();
    let userId: string | null = null;
    
    const supabaseAdmin = getSupabaseAdminClient();
    
    if (!session) {
      const authHeader = request.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
        if (error || !user) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        userId = user.id;
      } else {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    } else {
      userId = session.user.id;
    }

    // Check if user is a responder
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('is_responder')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    if (!profile.is_responder) {
      return NextResponse.json(
        { error: 'Forbidden - Responder access required' },
        { status: 403 }
      );
    }

    const now = new Date().toISOString();

    // Find all expired pending requests
    const { data: expiredRequests, error: fetchError } = await supabaseAdmin
      .from('assignment_requests')
      .select('*')
      .eq('status', 'pending')
      .lt('expires_at', now);

    if (fetchError) {
      throw fetchError;
    }

    if (!expiredRequests || expiredRequests.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No expired requests found',
        processed: 0
      });
    }

    console.log(`[Expired Requests] Found ${expiredRequests.length} expired requests`);

    const results = {
      processed: 0,
      moved: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Group by detection_id to process each detection once
    const detectionGroups = new Map<string, typeof expiredRequests>();
    expiredRequests.forEach(request => {
      if (!detectionGroups.has(request.detection_id)) {
        detectionGroups.set(request.detection_id, []);
      }
      detectionGroups.get(request.detection_id)!.push(request);
    });

    // Process each detection
    for (const [detectionId, requests] of detectionGroups) {
      try {
        // Mark all expired requests as expired
        const requestIds = requests.map(r => r.id);
        await supabaseAdmin
          .from('assignment_requests')
          .update({ status: 'expired', responded_at: now })
          .in('id', requestIds);

        results.processed += requests.length;

        // Check if detection already has an assignment
        const { data: existingAssignment } = await supabaseAdmin
          .from('responder_assignments')
          .select('id')
          .eq('detection_id', detectionId)
          .maybeSingle();

        if (existingAssignment) {
          // Already assigned, skip
          continue;
        }

        // Move to next responder
        const moved = await moveToNextResponder(detectionId);
        if (moved) {
          results.moved++;
          console.log(`[Expired Requests] Moved to next responder for detection ${detectionId}`);
        } else {
          results.failed++;
          results.errors.push(`No more responders available for detection ${detectionId}`);
          console.warn(`[Expired Requests] No more responders for detection ${detectionId}`);
        }

      } catch (error: any) {
        results.failed++;
        results.errors.push(`Detection ${detectionId}: ${error.message}`);
        console.error(`[Expired Requests] Error processing detection ${detectionId}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${results.processed} expired requests`,
      ...results
    });

  } catch (error: any) {
    console.error('Error processing expired requests:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/responders/process-expired
 * Same as POST, for easier cron job setup
 */
export async function GET(request: NextRequest) {
  return POST(request);
}

