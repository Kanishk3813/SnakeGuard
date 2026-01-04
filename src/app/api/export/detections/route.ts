import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/supabase-server';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { jsPDF } from 'jspdf';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
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

    // Allow all authenticated users to export (or restrict to admin if needed)
    const supabaseAdmin = getSupabaseAdminClient();

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'csv'; // csv or pdf
    const status = searchParams.get('status'); // optional filter
    const startDate = searchParams.get('startDate'); // optional filter
    const endDate = searchParams.get('endDate'); // optional filter
    const species = searchParams.get('species'); // optional filter

    // Build query
    let query = supabaseAdmin
      .from('snake_detections')
      .select('*')
      .order('timestamp', { ascending: false });

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    if (startDate) {
      query = query.gte('timestamp', startDate);
    }
    if (endDate) {
      query = query.lte('timestamp', endDate);
    }
    if (species) {
      query = query.ilike('species', `%${species}%`);
    }

    const { data: detections, error } = await query;

    if (error) {
      throw error;
    }

    if (!detections || detections.length === 0) {
      return NextResponse.json(
        { error: 'No detections found' },
        { status: 404 }
      );
    }

    // Generate export based on format
    if (format === 'pdf') {
      return await generatePDF(detections);
    } else {
      return generateCSV(detections);
    }
  } catch (error: any) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Failed to export detections', message: error.message },
      { status: 500 }
    );
  }
}

// Helper function to safely convert dates to ISO string
function safeDateToISO(dateValue: any): string {
  if (!dateValue) return 'N/A';
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toISOString();
  } catch {
    return 'N/A';
  }
}

function generateCSV(detections: any[]): NextResponse {
  const headers = [
    'ID',
    'Timestamp',
    'Species',
    'Confidence (%)',
    'Status',
    'Venomous',
    'Risk Level',
    'Latitude',
    'Longitude',
    'Classification Confidence (%)',
    'Classified At',
    'Notes',
    'Image URL',
    'Processed',
    'Created At'
  ];

  const rows = detections.map(d => [
    d.id || 'N/A',
    safeDateToISO(d.timestamp),
    d.species || 'Unknown',
    ((d.confidence || 0) * 100).toFixed(2),
    d.status || 'pending',
    d.venomous ? 'Yes' : 'No',
    d.risk_level || 'Unknown',
    d.latitude != null ? d.latitude.toFixed(6) : 'N/A',
    d.longitude != null ? d.longitude.toFixed(6) : 'N/A',
    d.classification_confidence ? ((d.classification_confidence * 100).toFixed(2)) : 'N/A',
    safeDateToISO(d.classified_at),
    (d.notes || '').replace(/"/g, '""'), // Escape quotes for CSV
    d.image_url || 'N/A',
    d.processed ? 'Yes' : 'No',
    safeDateToISO(d.created_at)
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  const filename = `snake-detections-${new Date().toISOString().split('T')[0]}.csv`;

  return new NextResponse(csvContent, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

async function generatePDF(detections: any[]): Promise<NextResponse> {
  try {
    // Calculate summary statistics
    const stats = {
      total: detections.length,
      pending: detections.filter(d => d.status === 'pending').length,
      reviewed: detections.filter(d => d.status === 'reviewed').length,
      captured: detections.filter(d => d.status === 'captured').length,
      falseAlarms: detections.filter(d => d.status === 'false_alarm').length,
      venomous: detections.filter(d => d.venomous).length,
      highRisk: detections.filter(d => d.risk_level === 'high' || d.risk_level === 'critical').length,
    };

    // Create PDF document
    const doc = new jsPDF();
    let yPos = 20;

    // Title
    doc.setFontSize(20);
    doc.text('Snake Detection Report', 105, yPos, { align: 'center' });
    yPos += 10;

    // Generated date and total
    doc.setFontSize(12);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 105, yPos, { align: 'center' });
    yPos += 7;
    doc.text(`Total Detections: ${detections.length}`, 105, yPos, { align: 'center' });
    yPos += 15;

    // Summary Statistics
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Summary Statistics', 20, yPos);
    yPos += 8;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Detections: ${stats.total}`, 20, yPos);
    yPos += 6;
    doc.text(`Pending: ${stats.pending} | Reviewed: ${stats.reviewed} | Captured: ${stats.captured} | False Alarms: ${stats.falseAlarms}`, 20, yPos);
    yPos += 6;
    doc.text(`Venomous: ${stats.venomous} | High/Critical Risk: ${stats.highRisk}`, 20, yPos);
    yPos += 12;

    // Detection Details Table
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Detection Details', 20, yPos);
    yPos += 8;

    // Table headers
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    const startX = 20;
    const colWidths = [30, 35, 25, 25, 25, 25, 35];
    const headers = ['Date', 'Species', 'Conf', 'Status', 'Venom', 'Risk', 'Location'];
    
    let xPos = startX;
    headers.forEach((header, i) => {
      doc.text(header, xPos, yPos);
      xPos += colWidths[i];
    });
    
    // Draw line under headers
    doc.setLineWidth(0.5);
    doc.line(startX, yPos + 2, startX + colWidths.reduce((a, b) => a + b, 0), yPos + 2);
    yPos += 8;

    // Table rows
    doc.setFont('helvetica', 'normal');
    detections.forEach((detection, index) => {
      // Check if we need a new page
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }

      const rowData = [
        new Date(detection.timestamp).toLocaleDateString(),
        (detection.species || 'Unknown').substring(0, 15),
        `${((detection.confidence || 0) * 100).toFixed(0)}%`,
        (detection.status || 'pending').substring(0, 8),
        detection.venomous ? 'Yes' : 'No',
        (detection.risk_level || 'N/A').substring(0, 8),
        detection.latitude && detection.longitude 
          ? `${detection.latitude.toFixed(2)}, ${detection.longitude.toFixed(2)}`
          : 'N/A'
      ];

      xPos = startX;
      rowData.forEach((cell, i) => {
        doc.text(String(cell), xPos, yPos, { maxWidth: colWidths[i] - 2 });
        xPos += colWidths[i];
      });

      yPos += 7;
    });

    // Generate PDF buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    const filename = `snake-detections-${new Date().toISOString().split('T')[0]}.pdf`;

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error: any) {
    throw new Error(`PDF generation failed: ${error.message}`);
  }
}

