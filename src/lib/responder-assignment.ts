import { getSupabaseAdminClient } from './supabaseAdmin';
import { calculateDistance } from './utils';

interface ResponderLocation {
  user_id: string;
  responder_location_lat: number;
  responder_location_lng: number;
  full_name: string | null;
  email: string | null;
}

interface ResponderWithDistance extends ResponderLocation {
  distance_km: number;
}

/**
 * Find closest responders to a detection location
 */
export async function findClosestResponders(
  detectionLat: number,
  detectionLng: number,
  maxResponders: number = 5
): Promise<ResponderWithDistance[]> {
  const supabaseAdmin = getSupabaseAdminClient();

  // Get all responders with valid locations
  const { data: responders, error } = await supabaseAdmin
    .from('user_profiles')
    .select('user_id, responder_location_lat, responder_location_lng, full_name')
    .eq('is_responder', true)
    .not('responder_location_lat', 'is', null)
    .not('responder_location_lng', 'is', null);

  if (error) {
    console.error('Error fetching responders:', error);
    return [];
  }

  if (!responders || responders.length === 0) {
    return [];
  }

  // Get emails for responders
  const { data: { users: authUsers } } = await supabaseAdmin.auth.admin.listUsers();
  const responderMap = new Map<string, string>();
  authUsers?.forEach(user => {
    responderMap.set(user.id, user.email || '');
  });

  // Calculate distances and sort
  const respondersWithDistance: ResponderWithDistance[] = responders
    .map(responder => {
      const distance = calculateDistance(
        detectionLat,
        detectionLng,
        responder.responder_location_lat!,
        responder.responder_location_lng!
      );
      return {
        user_id: responder.user_id,
        responder_location_lat: responder.responder_location_lat!,
        responder_location_lng: responder.responder_location_lng!,
        full_name: responder.full_name,
        email: responderMap.get(responder.user_id) || null,
        distance_km: distance
      };
    })
    .sort((a, b) => a.distance_km - b.distance_km)
    .slice(0, maxResponders);

  return respondersWithDistance;
}

/**
 * Create assignment requests for closest responders
 */
export async function createAssignmentRequests(
  detectionId: string,
  detectionLat: number,
  detectionLng: number
): Promise<{ success: boolean; requestsCreated: number; error?: string; message?: string }> {
  try {
    const supabaseAdmin = getSupabaseAdminClient();

    // Check if detection already has an assignment
    const { data: existingAssignment } = await supabaseAdmin
      .from('responder_assignments')
      .select('id')
      .eq('detection_id', detectionId)
      .maybeSingle();

    if (existingAssignment) {
      return { success: false, requestsCreated: 0, error: 'Detection already assigned' };
    }

    // Check for any expired requests and move to next responder first
    const now = new Date().toISOString();
    const { data: expiredRequests } = await supabaseAdmin
      .from('assignment_requests')
      .select('*')
      .eq('detection_id', detectionId)
      .eq('status', 'pending')
      .lt('expires_at', now);

    if (expiredRequests && expiredRequests.length > 0) {
      // Mark expired requests
      await supabaseAdmin
        .from('assignment_requests')
        .update({ status: 'expired', responded_at: now })
        .eq('detection_id', detectionId)
        .eq('status', 'pending')
        .lt('expires_at', now);
    }

    // Check for existing pending requests for this detection
    const { data: existingRequests } = await supabaseAdmin
      .from('assignment_requests')
      .select('responder_id')
      .eq('detection_id', detectionId)
      .eq('status', 'pending');

    const existingResponderIds = new Set((existingRequests || []).map(r => r.responder_id));

    // Find closest responders
    const closestResponders = await findClosestResponders(detectionLat, detectionLng, 5);

    if (closestResponders.length === 0) {
      return { success: false, requestsCreated: 0, error: 'No responders with valid locations found' };
    }

    // Filter out responders who already have pending requests
    const newResponders = closestResponders.filter(r => !existingResponderIds.has(r.user_id));

    if (newResponders.length === 0) {
      return { 
        success: true, 
        requestsCreated: 0, 
        message: 'All closest responders already have pending requests for this detection' 
      };
    }

    // Create requests only for new responders (starting with closest)
    const requests = newResponders.map((responder, index) => ({
      detection_id: detectionId,
      responder_id: responder.user_id,
      distance_km: responder.distance_km,
      priority: index, // 0 = closest, 1 = second closest, etc.
      status: 'pending' as const,
      requested_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
    }));

    // Insert all requests
    const { data: createdRequests, error: insertError } = await supabaseAdmin
      .from('assignment_requests')
      .insert(requests)
      .select();

    if (insertError) {
      // Handle duplicate key error gracefully
      if (insertError.code === '23505') {
        console.log('Assignment requests already exist for some responders, skipping duplicates');
        return { 
          success: true, 
          requestsCreated: 0, 
          message: 'Requests already exist for this detection' 
        };
      }
      console.error('Error creating assignment requests:', insertError);
      return { success: false, requestsCreated: 0, error: insertError.message };
    }

    // Send notification to the closest responder (first one)
    if (createdRequests && createdRequests.length > 0) {
      const closestRequest = createdRequests[0];
      await sendAssignmentRequestNotification(closestRequest.id, closestResponders[0]);
    }

    return {
      success: true,
      requestsCreated: createdRequests?.length || 0
    };

  } catch (error: any) {
    console.error('Error creating assignment requests:', error);
    return { success: false, requestsCreated: 0, error: error.message };
  }
}

/**
 * Send notification to responder about new assignment request
 */
async function sendAssignmentRequestNotification(
  requestId: string,
  responder: ResponderWithDistance
) {
  try {
    // Call notification API
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    await fetch(`${baseUrl}/api/notifications/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'assignment_request',
        recipientId: responder.user_id,
        recipientEmail: responder.email,
        data: {
          requestId,
          distance_km: responder.distance_km,
          message: `New snake detection ${responder.distance_km.toFixed(1)}km away. Please respond within 2 hours.`
        }
      })
    });
  } catch (error) {
    console.error('Error sending assignment request notification:', error);
    // Don't fail the whole process if notification fails
  }
}

/**
 * Move to next responder when current one times out or rejects
 */
export async function moveToNextResponder(detectionId: string): Promise<boolean> {
  try {
    const supabaseAdmin = getSupabaseAdminClient();

    // Get detection location
    const { data: detection } = await supabaseAdmin
      .from('snake_detections')
      .select('latitude, longitude')
      .eq('id', detectionId)
      .single();

    if (!detection || !detection.latitude || !detection.longitude) {
      return false;
    }

    // Get all pending requests for this detection, ordered by priority
    const { data: pendingRequests } = await supabaseAdmin
      .from('assignment_requests')
      .select('*')
      .eq('detection_id', detectionId)
      .eq('status', 'pending')
      .order('priority', { ascending: true });

    if (!pendingRequests || pendingRequests.length === 0) {
      // No more pending requests, find next closest responder
      const closestResponders = await findClosestResponders(
        detection.latitude,
        detection.longitude,
        5
      );

      // Get already contacted responder IDs
      const { data: allRequests } = await supabaseAdmin
        .from('assignment_requests')
        .select('responder_id')
        .eq('detection_id', detectionId);

      const contactedIds = new Set((allRequests || []).map(r => r.responder_id));

      // Find next uncontacted responder
      const nextResponder = closestResponders.find(r => !contactedIds.has(r.user_id));

      if (!nextResponder) {
        return false; // No more responders available
      }

      // Create new request for next responder
      const priority = (allRequests?.length || 0);
      const { data: newRequest } = await supabaseAdmin
        .from('assignment_requests')
        .insert({
          detection_id: detectionId,
          responder_id: nextResponder.user_id,
          distance_km: nextResponder.distance_km,
          priority,
          status: 'pending',
          requested_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single();

      if (newRequest) {
        await sendAssignmentRequestNotification(newRequest.id, nextResponder);
        return true;
      }

      return false;
    }

    // There are pending requests, notify the next one in queue
    const nextRequest = pendingRequests[0];
    
    // Get responder info
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('responder_location_lat, responder_location_lng, full_name')
      .eq('user_id', nextRequest.responder_id)
      .single();

    if (profile) {
      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
      const authUser = users?.find(u => u.id === nextRequest.responder_id);
      
      await sendAssignmentRequestNotification(nextRequest.id, {
        user_id: nextRequest.responder_id,
        responder_location_lat: profile.responder_location_lat!,
        responder_location_lng: profile.responder_location_lng!,
        full_name: profile.full_name,
        email: authUser?.email || null,
        distance_km: nextRequest.distance_km
      });
    }

    return true;

  } catch (error: any) {
    console.error('Error moving to next responder:', error);
    return false;
  }
}

