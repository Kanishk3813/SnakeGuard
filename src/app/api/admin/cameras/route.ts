import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { getServerSession } from '@/lib/supabase-server';

/**
 * GET /api/admin/cameras
 * Get all cameras with their stats
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication via session (cookies) or Bearer token
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

    // Get all cameras
    const { data: cameras, error: camerasError } = await supabaseAdmin
      .from('cameras')
      .select('*')
      .order('created_at', { ascending: false });

    if (camerasError) throw camerasError;

    // Get stats for each camera
    const camerasWithStats = await Promise.all(
      (cameras || []).map(async (camera) => {
        // Get detection counts
        const { count: totalDetections } = await supabaseAdmin
          .from('snake_detections')
          .select('*', { count: 'exact', head: true })
          .eq('device_id', camera.id);

        const { count: recentDetections } = await supabaseAdmin
          .from('snake_detections')
          .select('*', { count: 'exact', head: true })
          .eq('device_id', camera.id)
          .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

        // Get last detection
        const { data: lastDetection } = await supabaseAdmin
          .from('snake_detections')
          .select('timestamp, confidence, species, risk_level')
          .eq('device_id', camera.id)
          .order('timestamp', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Get average confidence
        const { data: detections } = await supabaseAdmin
          .from('snake_detections')
          .select('confidence')
          .eq('device_id', camera.id);

        const avgConfidence = detections && detections.length > 0
          ? detections.reduce((sum, d) => sum + (d.confidence || 0), 0) / detections.length
          : 0;

        return {
          ...camera,
          stats: {
            totalDetections: totalDetections || 0,
            recentDetections: recentDetections || 0,
            avgConfidence: Math.round(avgConfidence * 100) / 100,
            lastDetection: lastDetection || null,
          },
        };
      })
    );

    return NextResponse.json({ cameras: camerasWithStats });
  } catch (error: any) {
    console.error('Error fetching cameras:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch cameras' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/cameras
 * Create or update a camera
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication via session (cookies) or Bearer token
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

    const { device_id, name, description, latitude, longitude, stream_url, stream_port } = body;

    if (!device_id) {
      return NextResponse.json(
        { error: 'device_id is required' },
        { status: 400 }
      );
    }

    // Check if camera exists
    const { data: existing } = await supabaseAdmin
      .from('cameras')
      .select('id')
      .eq('device_id', device_id)
      .maybeSingle();

    const cameraData: any = {
      device_id,
      name: name || 'Camera',
      description: description || null,
      stream_url: stream_url || null,
      stream_port: stream_port || 8080,
      updated_at: new Date().toISOString(),
    };

    if (latitude !== undefined) cameraData.latitude = latitude;
    if (longitude !== undefined) cameraData.longitude = longitude;

    let result;
    if (existing) {
      // Update existing
      const { data, error } = await supabaseAdmin
        .from('cameras')
        .update(cameraData)
        .eq('id', existing.id)
        .select()
        .single();
      
      if (error) throw error;
      result = data;
    } else {
      // Create new
      const { data, error } = await supabaseAdmin
        .from('cameras')
        .insert(cameraData)
        .select()
        .single();
      
      if (error) throw error;
      result = data;
    }

    return NextResponse.json({ camera: result });
  } catch (error: any) {
    console.error('Error creating/updating camera:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create/update camera' },
      { status: 500 }
    );
  }
}

