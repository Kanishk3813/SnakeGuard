import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { getServerSession } from '@/lib/supabase-server';
import { calculateDistance } from '@/lib/utils';

/**
 * GET /api/responders/assignment-requests
 * Get pending assignment requests for the current responder
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

    const supabaseAdmin = getSupabaseAdminClient();
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || 'pending';

    // Debug logging
    console.log('[Assignment Requests API] Fetching requests:', {
      userId,
      status,
      hasSession: !!session
    });

    // First, check ALL requests for this user (any status) for debugging
    const { data: allRequestsDebug } = await supabaseAdmin
      .from('assignment_requests')
      .select('id, responder_id, status, detection_id, requested_at, expires_at')
      .eq('responder_id', userId);

    console.log('[Assignment Requests API] ALL requests for user (any status):', {
      count: (allRequestsDebug || []).length,
      requests: allRequestsDebug || []
    });

    // First try with detection relationship
    let requests: any[] = [];
    let error: any = null;

    const { data: requestsWithDetection, error: detectionError } = await supabaseAdmin
      .from('assignment_requests')
      .select(`
        *,
        detection:snake_detections(*)
      `)
      .eq('responder_id', userId)
      .eq('status', status)
      .order('requested_at', { ascending: false });

    if (detectionError) {
      console.error('[Assignment Requests API] Error with detection join:', detectionError);
      // Fallback: try without detection relationship
      const { data: requestsWithoutDetection, error: simpleError } = await supabaseAdmin
        .from('assignment_requests')
        .select('*')
        .eq('responder_id', userId)
        .eq('status', status)
        .order('requested_at', { ascending: false });
      
      if (simpleError) {
        error = simpleError;
      } else {
        requests = requestsWithoutDetection || [];
        console.log('[Assignment Requests API] Using fallback query (no detection join):', {
          count: requests.length,
          requestIds: requests.map(r => r.id)
        });
      }
    } else {
      requests = requestsWithDetection || [];
    }

    if (error) {
      console.error('[Assignment Requests API] Database error:', error);
      throw error;
    }

    console.log('[Assignment Requests API] Found requests:', {
      count: (requests || []).length,
      requestIds: (requests || []).map(r => r.id),
      responderIds: (requests || []).map(r => r.responder_id),
      statuses: (requests || []).map(r => r.status),
      // Check if detection relationship failed
      requestsWithDetection: (requests || []).filter(r => r.detection).length,
      requestsWithoutDetection: (requests || []).filter(r => !r.detection).length
    });

    // If we have requests but detection is null, fetch detections manually
    if (requests && requests.length > 0) {
      const requestsWithoutDetection = requests.filter(r => !r.detection);
      if (requestsWithoutDetection.length > 0) {
        console.warn('[Assignment Requests API] Some requests missing detection relationship, fetching manually:', {
          count: requestsWithoutDetection.length,
          detectionIds: requestsWithoutDetection.map(r => r.detection_id)
        });
        
        // Fetch detections manually
        const detectionIds = requestsWithoutDetection.map(r => r.detection_id).filter(Boolean);
        if (detectionIds.length > 0) {
          const { data: detections } = await supabaseAdmin
            .from('snake_detections')
            .select('*')
            .in('id', detectionIds);
          
          // Map detections to requests
          const detectionMap = new Map((detections || []).map(d => [d.id, d]));
          requests = requests.map(r => ({
            ...r,
            detection: r.detection || detectionMap.get(r.detection_id) || null
          }));
        }
      }
    }

    return NextResponse.json({
      success: true,
      requests: requests || [],
      count: (requests || []).length
    });

  } catch (error: any) {
    console.error('Error fetching assignment requests:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/responders/assignment-requests
 * Accept or reject an assignment request
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

    const body = await request.json();
    const { requestId, action } = body; // action: 'accept' or 'reject'

    if (!requestId || !action || !['accept', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'requestId and action (accept/reject) are required' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdminClient();

    // Get the assignment request from database
    const { data: assignmentRequest, error: fetchError } = await supabaseAdmin
      .from('assignment_requests')
      .select('*')
      .eq('id', requestId)
      .eq('responder_id', userId)
      .eq('status', 'pending')
      .single();

    if (fetchError || !assignmentRequest) {
      return NextResponse.json(
        { error: 'Request not found or already processed' },
        { status: 404 }
      );
    }

    // Check if request expired
    if (new Date(assignmentRequest.expires_at) < new Date()) {
      // Mark as expired
      await supabaseAdmin
        .from('assignment_requests')
        .update({ status: 'expired', responded_at: new Date().toISOString() })
        .eq('id', requestId);

      return NextResponse.json(
        { error: 'Request has expired' },
        { status: 400 }
      );
    }

    if (action === 'accept') {
      // Update request to accepted
      const { error: updateError } = await supabaseAdmin
        .from('assignment_requests')
        .update({
          status: 'accepted',
          responded_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (updateError) {
        throw updateError;
      }

      // Cancel all other pending requests for this detection
      await supabaseAdmin
        .from('assignment_requests')
        .update({ status: 'cancelled' })
        .eq('detection_id', assignmentRequest.detection_id)
        .eq('status', 'pending')
        .neq('id', requestId);

      // Check if assignment already exists
      const { data: existingAssignment } = await supabaseAdmin
        .from('responder_assignments')
        .select('id, detection_id, responder_id, status')
        .eq('detection_id', assignmentRequest.detection_id)
        .maybeSingle();

      let assignment: any = null;

      // Create the actual assignment if it doesn't exist
      if (!existingAssignment) {
        const { data: newAssignment, error: assignError } = await supabaseAdmin
          .from('responder_assignments')
          .insert({
            detection_id: assignmentRequest.detection_id,
            responder_id: userId,
            status: 'assigned',
            assigned_at: new Date().toISOString()
          })
          .select(`
            *,
            detection:snake_detections(*)
          `)
          .single();

        if (assignError) {
          // If assignment already exists (race condition), fetch it
          if (assignError.code === '23505') {
            const { data: fetchedAssignment, error: fetchErr } = await supabaseAdmin
              .from('responder_assignments')
              .select(`
                *,
                detection:snake_detections(*)
              `)
              .eq('detection_id', assignmentRequest.detection_id)
              .single();
            
            if (fetchErr) {
              console.error('Error fetching existing assignment:', fetchErr);
              throw new Error('Assignment exists but could not be retrieved');
            }
            assignment = fetchedAssignment;
          } else {
            console.error('Error creating assignment:', assignError);
            throw assignError;
          }
        } else {
          assignment = newAssignment;
          
          // Update detection status to 'reviewed' when assignment is created
          // This indicates that a responder has been assigned and is working on it
          const { error: detectionUpdateError } = await supabaseAdmin
            .from('snake_detections')
            .update({ 
              status: 'reviewed',
              updated_at: new Date().toISOString()
            })
            .eq('id', assignmentRequest.detection_id);
          
          if (detectionUpdateError) {
            console.error('Error updating detection status:', detectionUpdateError);
            // Don't fail the whole request if detection update fails
          }
        }
      } else {
        // Fetch full assignment with detection if it already exists
        const { data: fullAssignment, error: fetchError } = await supabaseAdmin
          .from('responder_assignments')
          .select(`
            *,
            detection:snake_detections(*)
          `)
          .eq('id', existingAssignment.id)
          .single();
        
        if (fetchError || !fullAssignment) {
          throw new Error('Assignment exists but could not be retrieved');
        }
        assignment = fullAssignment;
      }

      console.log('Assignment created/fetched:', {
        assignmentId: assignment?.id,
        detectionId: assignment?.detection_id,
        responderId: assignment?.responder_id,
        userId: userId,
        status: assignment?.status,
        hasDetection: !!assignment?.detection,
        assignedAt: assignment?.assigned_at,
        createdAt: assignment?.created_at
      });

      if (!assignment) {
        throw new Error('Assignment was not created or retrieved');
      }
      
      // Verify assignment was saved correctly
      const { data: verifyAssignment } = await supabaseAdmin
        .from('responder_assignments')
        .select('*')
        .eq('id', assignment.id)
        .single();
      
      console.log('Verified assignment in database:', verifyAssignment);

      return NextResponse.json({
        success: true,
        message: 'Assignment accepted successfully',
        assignment: assignment
      });

    } else if (action === 'reject') {
      // Update request to rejected
      const { error: updateError } = await supabaseAdmin
        .from('assignment_requests')
        .update({
          status: 'rejected',
          responded_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (updateError) {
        throw updateError;
      }

      // Trigger next responder assignment (this will be handled by a background job)
      // For now, we'll return success and the system will handle it

      return NextResponse.json({
        success: true,
        message: 'Assignment request rejected'
      });
    }

  } catch (error: any) {
    console.error('Error processing assignment request:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

