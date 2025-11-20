import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || 'all';
    const minConfidence = parseFloat(searchParams.get('minConfidence') || '0');
    
    let query = supabase
      .from('snake_detections')
      .select('latitude, longitude, confidence, timestamp')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);
    
    // Apply time range filter
    if (timeRange !== 'all') {
      const now = new Date();
      let startDate: Date;
      
      if (timeRange === 'week') {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (timeRange === 'month') {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      } else if (timeRange === 'year') {
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      } else {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }
      
      query = query.gte('timestamp', startDate.toISOString());
    }
    
    // Apply confidence filter
    if (minConfidence > 0) {
      query = query.gte('confidence', minConfidence);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching heatmap data:', error);
      return NextResponse.json(
        { error: 'Failed to fetch heatmap data' },
        { status: 500 }
      );
    }
    
    // Transform data for heatmap
    // Format: [lat, lng, intensity] where intensity is based on confidence
    const heatmapData = (data || [])
      .filter(d => 
        typeof d.latitude === 'number' && 
        typeof d.longitude === 'number' &&
        !isNaN(d.latitude) && 
        !isNaN(d.longitude)
      )
      .map(d => [
        d.latitude,
        d.longitude,
        d.confidence || 0.5 // Use confidence as intensity weight
      ]);
    
    // Calculate statistics
    const stats = {
      totalPoints: heatmapData.length,
      avgConfidence: data && data.length > 0
        ? data.reduce((sum: number, d: any) => sum + (d.confidence || 0), 0) / data.length
        : 0,
      maxIntensity: heatmapData.length > 0
        ? Math.max(...heatmapData.map(d => d[2] as number))
        : 0,
      minIntensity: heatmapData.length > 0
        ? Math.min(...heatmapData.map(d => d[2] as number))
        : 0,
    };
    
    return NextResponse.json({
      data: heatmapData,
      stats,
      timeRange,
      minConfidence
    });
  } catch (error: any) {
    console.error('Error in heatmap API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

