import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/admin-auth';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { IncidentPlaybook, IncidentPlaybookContact, IncidentPlaybookStep } from '@/types';
import { generateId } from '@/lib/id';

type GeneratePlaybookRequest = {
  species?: string | null;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  scenario?: string;
  location?: string;
  save?: boolean;
  titleHint?: string;
};

type GeneratedPlaybook = {
  title: string;
  overview: string;
  firstAid: string;
  steps: { title: string; description?: string }[];
  contacts: { name: string; role: string; phone?: string; email?: string }[];
};

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const user = await requireAdminUser(request);
    const body = (await request.json()) as GeneratePlaybookRequest;
    const { species, riskLevel, scenario, location, save = false, titleHint } = body;

    if (!riskLevel) {
      return NextResponse.json({ error: 'riskLevel is required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured. Please set it in your environment.' },
        { status: 500 }
      );
    }

    const prompt = buildPrompt({
      species,
      riskLevel,
      scenario,
      location,
      titleHint,
    });

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.4,
            topK: 32,
            topP: 1,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      return NextResponse.json(
        {
          error: 'Gemini API request failed',
          message: errorText || geminiResponse.statusText,
        },
        { status: 500 }
      );
    }

    const data = await geminiResponse.json();
    const text = extractTextFromGeminiResponse(data);

    if (!text) {
      return NextResponse.json(
        {
          error: 'Empty response from Gemini API',
          message: 'The API returned no usable content',
        },
        { status: 500 }
      );
    }

    const generated = parseGeneratedPlaybook(text, { species, riskLevel });
    const playbook: IncidentPlaybook = {
      id: generateId(),
      title: generated.title,
      risk_level: riskLevel,
      species: species ?? null,
      description: generated.overview,
      first_aid: generated.firstAid,
      steps: generated.steps.map(step => ({
        id: generateId(),
        title: step.title,
        description: step.description ?? '',
      })),
      contacts: generated.contacts.map(contact => ({
        id: generateId(),
        name: contact.name,
        role: contact.role,
        phone: contact.phone ?? '',
        email: contact.email ?? '',
      })),
    };

    let savedRecord: IncidentPlaybook | null = null;
    if (save) {
      const supabaseAdmin = getSupabaseAdminClient();
      const record = normalizePlaybookPayload(playbook, user.id);
      const { data: saved, error } = await supabaseAdmin
        .from('incident_playbooks')
        .insert(record)
        .select()
        .single();

      if (error) {
        console.error('Failed to save generated playbook:', error);
        return NextResponse.json(
          { error: 'Unable to save generated playbook', details: error.message },
          { status: 500 }
        );
      }

      savedRecord = formatPlaybookRecord(saved);
    }

    return NextResponse.json({
      playbook,
      saved: save ? savedRecord : undefined,
    });
  } catch (error: any) {
    console.error('Playbook generation error:', error);
    const message = error?.message || 'Unable to generate playbook';
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

function buildPrompt({
  species,
  riskLevel,
  scenario,
  location,
  titleHint,
}: {
  species?: string | null;
  riskLevel: string;
  scenario?: string;
  location?: string;
  titleHint?: string;
}) {
  const speciesText = species
    ? `Species involved: ${species}.`
    : 'Species unknown. Provide a generic playbook for this risk level.';
  const scenarioText = scenario ? `Scenario details: ${scenario}` : '';
  const locationText = location ? `Location context: ${location}` : '';
  const titleText = titleHint ? `Title hint: ${titleHint}` : '';

  return `You are an emergency incident planner specializing in snakebite response in India.
Create a detailed, culturally appropriate playbook for responders.

${speciesText}
Risk level: ${riskLevel}.
${scenarioText}
${locationText}
${titleText}

Respond ONLY with valid JSON using this schema:
{
  "title": "Short playbook title",
  "overview": "Brief overview of the situation and objectives (2-3 sentences)",
  "firstAid": "Immediate first aid instructions for victims",
  "steps": [
    { "title": "Step title", "description": "Detailed instructions" }
  ],
  "contacts": [
    { "name": "Contact name", "role": "Role or team", "phone": "Phone number", "email": "Email address" }
  ]
}

Guidelines:
- Provide 4-6 actionable steps (include medical, communication, containment, and community coordination).
- Steps must be sequential and detailed.
- Contacts should cover medical, wildlife, and local authorities (use placeholder contact info if unknown).
- Make sure JSON is valid and does not include Markdown or backticks.
`;
}

function extractTextFromGeminiResponse(data: any) {
  if (!data?.candidates?.length) return '';
  const parts = data.candidates[0]?.content?.parts;
  if (!parts?.length) return '';
  return parts
    .map((part: any) => part?.text || '')
    .filter(Boolean)
    .join('\n')
    .trim();
}

function parseGeneratedPlaybook(text: string, defaults: { species?: string | null; riskLevel: string }) {
  try {
    const cleaned = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned) as GeneratedPlaybook;

    return {
      title: parsed.title?.trim() || buildDefaultTitle(defaults),
      overview:
        parsed.overview?.trim() ||
        `Response plan for ${defaults.species || 'snake'} (${defaults.riskLevel} risk).`,
      firstAid:
        parsed.firstAid?.trim() ||
        'Keep the victim calm, immobilize the limb, and transport to the nearest hospital immediately.',
      steps: Array.isArray(parsed.steps) && parsed.steps.length > 0 ? parsed.steps : buildDefaultSteps(),
      contacts:
        Array.isArray(parsed.contacts) && parsed.contacts.length > 0 ? parsed.contacts : buildDefaultContacts(),
    };
  } catch (error) {
    console.warn('Failed to parse generated playbook, using fallback:', error);
    return {
      title: buildDefaultTitle(defaults),
      overview: `Response plan for ${defaults.species || 'snake'} (${defaults.riskLevel} risk).`,
      firstAid: 'Keep the victim calm, immobilize the limb, and transport to the nearest hospital immediately.',
      steps: buildDefaultSteps(),
      contacts: buildDefaultContacts(),
    };
  }
}

function buildDefaultTitle({ species, riskLevel }: { species?: string | null; riskLevel: string }) {
  if (species) {
    return `${species} Incident Playbook (${riskLevel} risk)`;
  }
  return `Snake Incident Playbook (${riskLevel} risk)`;
}

function buildDefaultSteps(): GeneratedPlaybook['steps'] {
  return [
    { title: 'Stabilize the Victim', description: 'Calm the victim, immobilize the bitten limb, and monitor vitals.' },
    {
      title: 'Alert Medical Team',
      description: 'Call the nearest hospital with antivenom availability and prepare for transport.',
    },
    {
      title: 'Secure the Area',
      description: 'Keep bystanders away and deploy wildlife team to locate and identify the snake.',
    },
  ];
}

function buildDefaultContacts(): GeneratedPlaybook['contacts'] {
  return [
    { name: 'District Hospital Control Room', role: 'Medical', phone: '+91-XXXXXXXXXX' },
    { name: 'Forest Range Officer', role: 'Wildlife Response', phone: '+91-XXXXXXXXXX' },
    { name: 'Local Emergency Coordinator', role: 'Community Coordination', phone: '+91-XXXXXXXXXX' },
  ];
}

function normalizePlaybookPayload(playbook: IncidentPlaybook, createdBy: string) {
  return {
    id: playbook.id,
    title: playbook.title?.trim() || 'Untitled Playbook',
    risk_level: playbook.risk_level,
    species: playbook.species?.trim() || null,
    description: playbook.description || null,
    first_aid: playbook.first_aid || null,
    created_by: createdBy,
    steps: Array.isArray(playbook.steps)
      ? playbook.steps.map(step => ({
          id: step.id || generateId(),
          title: step.title ?? '',
          description: step.description ?? '',
        }))
      : [],
    contacts: Array.isArray(playbook.contacts)
      ? playbook.contacts.map(contact => ({
          id: contact.id || generateId(),
          name: contact.name ?? '',
          role: contact.role ?? '',
          phone: contact.phone ?? '',
          email: contact.email ?? '',
        }))
      : [],
  };
}

function formatPlaybookRecord(record: any): IncidentPlaybook {
  return {
    id: record.id,
    title: record.title,
    risk_level: record.risk_level,
    species: record.species,
    description: record.description,
    first_aid: record.first_aid,
    steps: record.steps || [],
    contacts: record.contacts || [],
    created_by: record.created_by,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

