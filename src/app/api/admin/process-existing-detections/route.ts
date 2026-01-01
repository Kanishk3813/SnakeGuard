import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { getServerSession } from '@/lib/supabase-server';
import { createAssignmentRequests } from '@/lib/responder-assignment';

/**
 * POST /api/admin/process-existing-detections
 * Process existing snake detections and send assignment requests to closest responders
 * Admin only endpoint
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    let userId: string | null = null;
    
    if (!session) {
      const authHeader = request.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        const supabaseAdmin = getSupabaseAdminClient();
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

    // Check if user is admin
    const supabaseAdmin = getSupabaseAdminClient();
    const { data: adminRecord } = await supabaseAdmin
      .from('admin_users')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!adminRecord) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { limit = 50, onlyUnassigned = true } = body;

    // Get existing detections
    let query = supabaseAdmin
      .from('snake_detections')
      .select('id, latitude, longitude, status, processed')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .neq('status', 'captured')
      .neq('status', 'false_alarm')
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (onlyUnassigned) {
      // Get detections that don't have assignments
      const { data: assignedDetections } = await supabaseAdmin
        .from('responder_assignments')
        .select('detection_id');

      const assignedIds = (assignedDetections || []).map(a => a.detection_id);
      
      if (assignedIds.length > 0) {
        // Filter out assigned detections - Supabase .not() with 'in' requires array format
        // Use multiple .neq() calls or filter in JavaScript
        // For better performance with many IDs, we'll filter in memory after fetch
      }
    }

    let { data: detections, error: fetchError } = await query;
    
    if (fetchError) {
      console.error('Error fetching detections:', fetchError);
      throw fetchError;
    }

    // Filter out assigned detections in memory if needed
    if (onlyUnassigned && detections && detections.length > 0) {
      const { data: assignedDetections } = await supabaseAdmin
        .from('responder_assignments')
        .select('detection_id');
      
      const assignedIds = new Set((assignedDetections || []).map(a => a.detection_id));
      detections = detections.filter(d => !assignedIds.has(d.id));
    }

    if (!detections || detections.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No detections to process',
        processed: 0,
        succeeded: 0,
        failed: 0,
        errors: []
      });
    }

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Process each detection
    for (const detection of detections) {
      try {
        const assignmentResult = await createAssignmentRequests(
          detection.id,
          detection.latitude!,
          detection.longitude!
        );

        if (assignmentResult.success) {
          results.succeeded++;
          results.processed++;
        } else {
          results.failed++;
          results.errors.push(`${detection.id}: ${assignmentResult.error || 'Failed'}`);
        }
      } catch (error: any) {
        results.failed++;
        results.errors.push(`${detection.id}: ${error.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${results.processed} detections`,
      ...results
    });

  } catch (error: any) {
    console.error('Error processing existing detections:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/process-existing-detections
 * Get stats about unprocessed detections
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    let userId: string | null = null;
    
    if (!session) {
      const authHeader = request.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        const supabaseAdmin = getSupabaseAdminClient();
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

    // Check if user is admin
    const supabaseAdmin = getSupabaseAdminClient();
    const { data: adminRecord } = await supabaseAdmin
      .from('admin_users')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!adminRecord) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    // Get all eligible detections first
    let query = supabaseAdmin
      .from('snake_detections')
      .select('id')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .neq('status', 'captured')
      .neq('status', 'false_alarm');

    const { data: allDetections, error: queryError } = await query;

    if (queryError) {
      throw queryError;
    }

    // Get assigned detections
    const { data: assignedDetections } = await supabaseAdmin
      .from('responder_assignments')
      .select('detection_id');

    const assignedIds = new Set((assignedDetections || []).map(a => a.detection_id));
    
    // Filter out assigned detections
    const unassignedDetections = (allDetections || []).filter(d => !assignedIds.has(d.id));
    const count = unassignedDetections.length;

    return NextResponse.json({
      success: true,
      unassignedCount: count
    });

  } catch (error: any) {
    console.error('Error getting detection stats:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

