import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { getServerSession } from '@/lib/supabase-server';

/**
 * GET /api/admin/cameras/[id]
 * Get single camera with detailed stats
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params (Next.js 15 requirement)
    const { id } = await params;

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

    const { data: camera, error } = await supabaseAdmin
      .from('cameras')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!camera) {
      return NextResponse.json({ error: 'Camera not found' }, { status: 404 });
    }

    // Get detailed stats
    const { count: totalDetections } = await supabaseAdmin
      .from('snake_detections')
      .select('*', { count: 'exact', head: true })
      .eq('device_id', camera.id);

    const { count: todayDetections } = await supabaseAdmin
      .from('snake_detections')
      .select('*', { count: 'exact', head: true })
      .eq('device_id', camera.id)
      .gte('timestamp', new Date().toISOString().split('T')[0]);

    const { data: detections } = await supabaseAdmin
      .from('snake_detections')
      .select('confidence, species, risk_level, timestamp')
      .eq('device_id', camera.id)
      .order('timestamp', { ascending: false })
      .limit(100);

    const avgConfidence = detections && detections.length > 0
      ? detections.reduce((sum, d) => sum + (d.confidence || 0), 0) / detections.length
      : 0;

    // Species breakdown
    const speciesCount: Record<string, number> = {};
    detections?.forEach(d => {
      if (d.species) {
        speciesCount[d.species] = (speciesCount[d.species] || 0) + 1;
      }
    });

    // Risk level breakdown
    const riskCount: Record<string, number> = {};
    detections?.forEach(d => {
      if (d.risk_level) {
        riskCount[d.risk_level] = (riskCount[d.risk_level] || 0) + 1;
      }
    });

    return NextResponse.json({
      camera: {
        ...camera,
        stats: {
          totalDetections: totalDetections || 0,
          todayDetections: todayDetections || 0,
          avgConfidence: Math.round(avgConfidence * 100) / 100,
          speciesBreakdown: speciesCount,
          riskBreakdown: riskCount,
          recentDetections: detections?.slice(0, 10) || [],
        },
      },
    });
  } catch (error: any) {
    console.error('Error fetching camera:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch camera' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/cameras/[id]
 * Update camera
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params (Next.js 15 requirement)
    const { id } = await params;

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

    const { name, description, latitude, longitude, stream_url, status } = body;

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (latitude !== undefined) updateData.latitude = latitude;
    if (longitude !== undefined) updateData.longitude = longitude;
    if (stream_url !== undefined) updateData.stream_url = stream_url;
    if (status !== undefined) updateData.status = status;

    const { data, error } = await supabaseAdmin
      .from('cameras')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ camera: data });
  } catch (error: any) {
    console.error('Error updating camera:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update camera' },
      { status: 500 }
    );
  }
}

