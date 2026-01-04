import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { supabase } from '@/lib/supabase';
import { getServerSession } from '@/lib/supabase-server';

/**
 * GET /api/responders/assignments
 * Get all assignments (with optional filters)
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
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    } else {
      userId = session.user.id;
    }

    // Check if user is a responder
    const supabaseAdmin = getSupabaseAdminClient();
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

    const searchParams = request.nextUrl.searchParams;
    const responderId = searchParams.get('responder_id');
    const status = searchParams.get('status');
    const includeUnassigned = searchParams.get('include_unassigned') === 'true';

    // Get assignments - try with detection relationship first
    let assignmentsQuery = supabaseAdmin
      .from('responder_assignments')
      .select(`
        *,
        detection:snake_detections(*)
      `);

    if (responderId) {
      assignmentsQuery = assignmentsQuery.eq('responder_id', responderId);
    }
    if (status) {
      assignmentsQuery = assignmentsQuery.eq('status', status);
    }

    // Order by assigned_at or created_at (whichever is available)
    assignmentsQuery = assignmentsQuery.order('assigned_at', { ascending: false, nullsFirst: false });

    let { data: assignments, error: assignmentsError } = await assignmentsQuery;
    
    // If query fails due to relationship issue, try without detection join
    if (assignmentsError && (assignmentsError.message?.includes('relation') || assignmentsError.message?.includes('foreign'))) {
      console.warn('Relationship query failed, trying without detection join:', assignmentsError.message);
      
      let fallbackQuery = supabaseAdmin
        .from('responder_assignments')
        .select('*');

      if (responderId) {
        fallbackQuery = fallbackQuery.eq('responder_id', responderId);
      }
      if (status) {
        fallbackQuery = fallbackQuery.eq('status', status);
      }
      fallbackQuery = fallbackQuery.order('assigned_at', { ascending: false });

      const { data: fallbackAssignments, error: fallbackError } = await fallbackQuery;
      
      if (!fallbackError && fallbackAssignments) {
        // Manually fetch detections
        const detectionIds = fallbackAssignments.map(a => a.detection_id).filter(Boolean);
        let detectionsMap: Record<string, any> = {};
        
        if (detectionIds.length > 0) {
          const { data: detections } = await supabaseAdmin
            .from('snake_detections')
            .select('*')
            .in('id', detectionIds);
          
          if (detections) {
            detections.forEach(d => {
              detectionsMap[d.id] = d;
            });
          }
        }
        
        // Combine assignments with detections
        assignments = fallbackAssignments.map(a => ({
          ...a,
          detection: detectionsMap[a.detection_id] || null
        }));
        assignmentsError = null;
      } else {
        throw fallbackError || assignmentsError;
      }
    }
    
    console.log('Assignments query result:', { 
      userId,
      responderId, 
      status, 
      count: assignments?.length || 0,
      assignmentIds: assignments?.map(a => a.id) || [],
      error: assignmentsError?.message 
    });
    
    // Log each assignment to debug
    if (assignments && assignments.length > 0) {
      console.log('Assignments details:', assignments.map(a => ({
        id: a.id,
        detection_id: a.detection_id,
        responder_id: a.responder_id,
        status: a.status,
        hasDetection: !!a.detection
      })));
    }

    if (assignmentsError) {
      throw assignmentsError;
    }

    // Get responder info for assignments
    const responderIds = [...new Set((assignments || []).map(a => a.responder_id))];
    const responderInfo: Record<string, any> = {};

    if (responderIds.length > 0) {
      const { data: users } = await supabaseAdmin.auth.admin.listUsers();
      if (users) {
        users.users.forEach(user => {
          responderInfo[user.id] = {
            id: user.id,
            email: user.email,
          };
        });
      }

      // Get user profiles for full names
      const { data: profiles } = await supabaseAdmin
        .from('user_profiles')
        .select('user_id, full_name')
        .in('user_id', responderIds);

      if (profiles) {
        profiles.forEach(profile => {
          if (responderInfo[profile.user_id]) {
            responderInfo[profile.user_id].full_name = profile.full_name;
          }
        });
      }
    }

    const assignmentsWithResponder = (assignments || []).map(assignment => ({
      ...assignment,
      responder: responderInfo[assignment.responder_id] || null
    }));

    // If include_unassigned, get detections without assignments
    let unassignedDetections: any[] = [];
    if (includeUnassigned) {
      const assignedDetectionIds = (assignments || []).map(a => a.detection_id).filter(Boolean);
      
      console.log('[Assignments API] Fetching unassigned detections:', {
        assignedCount: assignedDetectionIds.length,
        assignedIds: assignedDetectionIds
      });
      
      // Get all detections that are not captured or false_alarm
      // Also include detections with null status (new detections)
      // Use a simpler approach: get all, then filter in memory
      let unassignedQuery = supabaseAdmin
        .from('snake_detections')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100); // Limit to most recent 100

      const { data: allDetections, error: allDetectionsError } = await unassignedQuery;
      
      // Filter out captured and false_alarm in memory (more reliable)
      const eligibleDetections = (allDetections || []).filter(d => 
        d.status !== 'captured' && d.status !== 'false_alarm'
      );

      console.log('[Assignments API] All detections query result:', {
        count: allDetections?.length || 0,
        error: allDetectionsError?.message,
        detectionIds: allDetections?.map(d => d.id) || []
      });
      
      if (!allDetectionsError && eligibleDetections) {
        // Filter out assigned detections in memory
        if (assignedDetectionIds.length > 0) {
          unassignedDetections = eligibleDetections.filter(d => !assignedDetectionIds.includes(d.id));
        } else {
          unassignedDetections = eligibleDetections;
        }
        
        console.log('[Assignments API] Final unassigned detections:', {
          totalDetections: allDetections?.length || 0,
          eligibleAfterStatusFilter: eligibleDetections.length,
          unassignedAfterAssignmentFilter: unassignedDetections.length,
          detectionIds: unassignedDetections.map(d => d.id),
          statuses: unassignedDetections.map(d => d.status),
          timestamps: unassignedDetections.map(d => d.timestamp)
        });
      } else if (allDetectionsError) {
        console.error('[Assignments API] Error fetching detections:', allDetectionsError);
      }
    }

    return NextResponse.json({
      success: true,
      assignments: assignmentsWithResponder,
      unassigned: includeUnassigned ? unassignedDetections : [],
      count: assignmentsWithResponder.length
    });

  } catch (error: any) {
    console.error('Error fetching assignments:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/responders/assignments
 * Assign a responder to a detection (claim a detection)
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
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    } else {
      userId = session.user.id;
    }

    // Check if user is a responder
    const supabaseAdmin = getSupabaseAdminClient();
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

    const body = await request.json();
    const { detectionId, notes } = body;

    if (!detectionId) {
      return NextResponse.json(
        { error: 'detectionId is required' },
        { status: 400 }
      );
    }

    // Check if detection exists and is not captured
    const { data: detection, error: detectionError } = await supabaseAdmin
      .from('snake_detections')
      .select('id, status')
      .eq('id', detectionId)
      .single();

    if (detectionError || !detection) {
      return NextResponse.json(
        { error: 'Detection not found' },
        { status: 404 }
      );
    }

    if (detection.status === 'captured') {
      return NextResponse.json(
        { error: 'Snake already captured' },
        { status: 400 }
      );
    }

    // Check if already assigned
    const { data: existingAssignment } = await supabaseAdmin
      .from('responder_assignments')
      .select('*')
      .eq('detection_id', detectionId)
      .maybeSingle();

    if (existingAssignment) {
      return NextResponse.json(
        { 
          error: 'Detection already assigned',
          assignment: existingAssignment,
          message: 'Another responder has already claimed this detection'
        },
        { status: 409 }
      );
    }

    // Create assignment
    const { data: assignment, error: insertError } = await supabaseAdmin
      .from('responder_assignments')
      .insert({
        detection_id: detectionId,
        responder_id: userId,
        status: 'assigned',
        notes: notes || null,
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    // Update detection status to 'reviewed' when assignment is created
    // This indicates that a responder has been assigned and is working on it
    const { error: detectionUpdateError } = await supabaseAdmin
      .from('snake_detections')
      .update({ 
        status: 'reviewed',
        updated_at: new Date().toISOString()
      })
      .eq('id', detectionId);
    
    if (detectionUpdateError) {
      console.error('Error updating detection status:', detectionUpdateError);
      // Don't fail the whole request if detection update fails
    }

    return NextResponse.json({
      success: true,
      assignment,
      message: 'Detection assigned successfully'
    });

  } catch (error: any) {
    console.error('Error creating assignment:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

