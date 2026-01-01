import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { supabase } from '@/lib/supabase';
import { getServerSession } from '@/lib/supabase-server';

/**
 * PATCH /api/responders/assignments/[id]
 * Update assignment status (in_progress, completed, cancelled)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: assignmentId } = await params;
    
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
    const { status, notes, arrived_at, completed_at } = body;

    // Check if assignment exists and belongs to user
    const { data: assignment, error: fetchError } = await supabaseAdmin
      .from('responder_assignments')
      .select('*')
      .eq('id', assignmentId)
      .single();

    if (fetchError || !assignment) {
      return NextResponse.json(
        { error: 'Assignment not found' },
        { status: 404 }
      );
    }

    if (assignment.responder_id !== userId) {
      return NextResponse.json(
        { error: 'You can only update your own assignments' },
        { status: 403 }
      );
    }

    // Build update object
    const updates: any = {
      updated_at: new Date().toISOString()
    };

    if (status) {
      updates.status = status;
    }
    if (notes !== undefined) {
      updates.notes = notes;
    }
    if (arrived_at !== undefined) {
      updates.arrived_at = arrived_at;
    }
    if (completed_at !== undefined) {
      updates.completed_at = completed_at;
    }

    // Auto-set timestamps based on status
    if (status === 'in_progress' && !assignment.arrived_at) {
      updates.arrived_at = new Date().toISOString();
    }
    if (status === 'completed' && !assignment.completed_at) {
      updates.completed_at = new Date().toISOString();
    }

    const { data: updatedAssignment, error: updateError } = await supabaseAdmin
      .from('responder_assignments')
      .update(updates)
      .eq('id', assignmentId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // Update detection status based on assignment status
    if (status) {
      let detectionStatusUpdate: string | null = null;
      
      switch (status) {
        case 'in_progress':
          // When responder starts working on it, mark detection as reviewed
          detectionStatusUpdate = 'reviewed';
          break;
        case 'completed':
          // When assignment is completed, snake is captured
          detectionStatusUpdate = 'captured';
          break;
        case 'cancelled':
          // When assignment is cancelled, revert detection to pending (if it was reviewed)
          // But don't change if it was already captured
          const { data: currentDetection, error: detectionFetchError } = await supabaseAdmin
            .from('snake_detections')
            .select('status')
            .eq('id', assignment.detection_id)
            .single();
          
          // Only revert if not already captured and detection exists
          if (!detectionFetchError && currentDetection && currentDetection.status !== 'captured') {
            detectionStatusUpdate = 'pending';
          }
          break;
        default:
          // For 'assigned' status, don't change detection status
          break;
      }
      
      // Update detection status if needed
      if (detectionStatusUpdate) {
        const { error: detectionUpdateError } = await supabaseAdmin
          .from('snake_detections')
          .update({ 
            status: detectionStatusUpdate,
            updated_at: new Date().toISOString()
          })
          .eq('id', assignment.detection_id);
        
        if (detectionUpdateError) {
          console.error('Error updating detection status:', detectionUpdateError);
          // Don't fail the whole request if detection update fails
        }
      }
    }

    return NextResponse.json({
      success: true,
      assignment: updatedAssignment,
      message: 'Assignment updated successfully'
    });

  } catch (error: any) {
    console.error('Error updating assignment:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/responders/assignments/[id]
 * Unassign responder from detection
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: assignmentId } = await params;
    
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

    // Check if assignment exists and belongs to user
    const { data: assignment, error: fetchError } = await supabaseAdmin
      .from('responder_assignments')
      .select('*')
      .eq('id', assignmentId)
      .single();

    if (fetchError || !assignment) {
      return NextResponse.json(
        { error: 'Assignment not found' },
        { status: 404 }
      );
    }

    if (assignment.responder_id !== userId) {
      return NextResponse.json(
        { error: 'You can only unassign your own assignments' },
        { status: 403 }
      );
    }

    // Delete assignment
    const { error: deleteError } = await supabaseAdmin
      .from('responder_assignments')
      .delete()
      .eq('id', assignmentId);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({
      success: true,
      message: 'Assignment removed successfully'
    });

  } catch (error: any) {
    console.error('Error deleting assignment:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

