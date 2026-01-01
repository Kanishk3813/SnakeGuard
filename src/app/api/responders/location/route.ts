import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { getServerSession } from '@/lib/supabase-server';

/**
 * GET /api/responders/location
 * Get responder's saved location
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session) {
      // Try Authorization header
      const authHeader = request.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        const supabaseAdmin = getSupabaseAdminClient();
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
        if (error || !user) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        const { data: profile } = await supabaseAdmin
          .from('user_profiles')
          .select('responder_location_lat, responder_location_lng, responder_location_updated_at')
          .eq('user_id', user.id)
          .single();
        
        return NextResponse.json({
          success: true,
          location: (profile && profile.responder_location_lat && profile.responder_location_lng) ? {
            lat: profile.responder_location_lat,
            lng: profile.responder_location_lng,
            updated_at: profile.responder_location_updated_at
          } : null
        });
      }
      
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdminClient();
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('responder_location_lat, responder_location_lng, responder_location_updated_at')
      .eq('user_id', session.user.id)
      .single();

    return NextResponse.json({
      success: true,
      location: (profile && profile.responder_location_lat && profile.responder_location_lng) ? {
        lat: profile.responder_location_lat,
        lng: profile.responder_location_lng,
        updated_at: profile.responder_location_updated_at
      } : null
    });

  } catch (error: any) {
    console.error('Error fetching responder location:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/responders/location
 * Save or update responder's location
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    let userId: string | null = null;
    
    if (!session) {
      // Try Authorization header
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
    const { latitude, longitude } = body;

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return NextResponse.json(
        { error: 'latitude and longitude (numbers) are required' },
        { status: 400 }
      );
    }

    // Validate coordinates
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return NextResponse.json(
        { error: 'Invalid coordinates' },
        { status: 400 }
      );
    }

    // Update responder location
    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from('user_profiles')
      .update({
        responder_location_lat: latitude,
        responder_location_lng: longitude,
        responder_location_updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select('responder_location_lat, responder_location_lng, responder_location_updated_at')
      .single();

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      message: 'Location updated successfully',
      location: {
        lat: updatedProfile.responder_location_lat,
        lng: updatedProfile.responder_location_lng,
        updated_at: updatedProfile.responder_location_updated_at
      }
    });

  } catch (error: any) {
    console.error('Error updating responder location:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

