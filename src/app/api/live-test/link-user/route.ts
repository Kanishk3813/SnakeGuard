import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';

const LIVE_TEST_DEVICE_ID = '15f5320e-6cff-4b17-b49c-70bb253307ff'; // Camera UUID

/**
 * GET  /api/live-test/link-user  → Check who is currently linked
 * POST /api/live-test/link-user  → Link a user email to the live test camera
 * DELETE /api/live-test/link-user → Unlink / set camera offline
 */

// ─── GET: Check current link status ─────────────────────────────────────────

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdminClient();

    const { data: camera } = await supabaseAdmin
      .from('cameras')
      .select('*')
      .eq('device_id', LIVE_TEST_DEVICE_ID)
      .maybeSingle();

    if (!camera || !camera.user_id) {
      return NextResponse.json({ linked: false });
    }

    // Resolve user email from auth
    const {
      data: { user },
    } = await supabaseAdmin.auth.admin.getUserById(camera.user_id);

    return NextResponse.json({
      linked: true,
      email: user?.email || 'unknown',
      userId: camera.user_id,
      status: camera.status,
      deviceId: camera.device_id,
    });
  } catch (error: any) {
    console.error('[LinkUser] GET error:', error);
    return NextResponse.json({ linked: false, error: error.message });
  }
}

// ─── POST: Link a user by email ─────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdminClient();

    // Look up user by email via Supabase Auth admin
    const {
      data: { users },
      error: listError,
    } = await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
      return NextResponse.json(
        { error: 'Failed to look up users' },
        { status: 500 }
      );
    }

    const targetUser = users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (!targetUser) {
      return NextResponse.json(
        { error: `No account found for ${email}. Make sure this email is registered in the mobile app.` },
        { status: 404 }
      );
    }

    // Check if the live-test camera already exists
    const { data: existing } = await supabaseAdmin
      .from('cameras')
      .select('id')
      .eq('device_id', LIVE_TEST_DEVICE_ID)
      .maybeSingle();

    if (existing) {
      // Update the existing camera → new user
      await supabaseAdmin
        .from('cameras')
        .update({
          user_id: targetUser.id,
          name: 'Live Test Camera',
          description: 'Virtual camera for live test video feed — detections auto-sync to mobile app',
          status: 'online',
          stream_type: 'mjpeg',
          latitude: 12.8231,
          longitude: 80.0444,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      // Create a new camera entry
      await supabaseAdmin.from('cameras').insert({
        device_id: LIVE_TEST_DEVICE_ID,
        name: 'Live Test Camera',
        description: 'Virtual camera for live test video feed — detections auto-sync to mobile app',
        status: 'online',
        stream_type: 'mjpeg',
        user_id: targetUser.id,
        latitude: 12.8231,
        longitude: 80.0444,
      });
    }

    console.log(
      `[LinkUser] ✅ Linked live-test camera to ${email} (${targetUser.id})`
    );

    return NextResponse.json({
      success: true,
      message: `Live test camera linked to ${email}`,
      email: targetUser.email,
      userId: targetUser.id,
    });
  } catch (error: any) {
    console.error('[LinkUser] POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── DELETE: Unlink the live-test camera ────────────────────────────────────

export async function DELETE() {
  try {
    const supabaseAdmin = getSupabaseAdminClient();

    await supabaseAdmin
      .from('cameras')
      .update({
        status: 'offline',
        updated_at: new Date().toISOString(),
      })
      .eq('device_id', LIVE_TEST_DEVICE_ID);

    console.log('[LinkUser] Live-test camera set to offline');

    return NextResponse.json({
      success: true,
      message: 'Live test camera unlinked',
    });
  } catch (error: any) {
    console.error('[LinkUser] DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
