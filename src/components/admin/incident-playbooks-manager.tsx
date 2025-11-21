/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { IncidentPlaybook, IncidentPlaybookContact, IncidentPlaybookStep } from '@/types';
import { generateId } from '@/lib/id';
import {
  AlertTriangle,
  ClipboardList,
  Plus,
  Save,
  Trash2,
  Users,
  Loader2,
  Shield,
} from 'lucide-react';

type FormState = IncidentPlaybook;

const riskOptions = [
  { label: 'Critical Venomous', value: 'critical' },
  { label: 'High Venomous', value: 'high' },
  { label: 'Medium Risk', value: 'medium' },
  { label: 'Low / Non-venomous', value: 'low' },
];

export default function IncidentPlaybooksManager() {
  const [playbooks, setPlaybooks] = useState<IncidentPlaybook[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPlaybooks();
  }, []);

  const activePlaybook = useMemo(
    () => playbooks.find(pb => pb.id === selectedId) ?? null,
    [playbooks, selectedId]
  );

  const isDirty = useMemo(() => {
    if (!formState) return false;
    if (!activePlaybook && formState) return true;
    return JSON.stringify(formState) !== JSON.stringify(activePlaybook);
  }, [formState, activePlaybook]);

  async function loadPlaybooks() {
    try {
      setLoading(true);
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) throw new Error('Missing admin session');

      const response = await fetch('/api/admin/playbooks', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Failed to load playbooks');
      setPlaybooks(body.data || []);
      if (!selectedId && body.data?.length) {
        setSelectedId(body.data[0].id);
        setFormState(body.data[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Unable to load playbooks');
    } finally {
      setLoading(false);
    }
  }

  function startNewPlaybook() {
    const blank: IncidentPlaybook = {
      id: generateId(),
      title: 'New Incident Playbook',
      risk_level: 'high',
      species: '',
      description: '',
      first_aid: '',
      steps: [
        {
          id: generateId(),
          title: 'Notify nearest ranger',
          description: 'Call and share exact GPS + photo',
        },
      ],
      contacts: [],
    };
    setSelectedId(blank.id);
    setFormState(blank);
  }

  function onSelect(playbook: IncidentPlaybook) {
    setSelectedId(playbook.id);
    setFormState(playbook);
  }

  function updateForm(partial: Partial<FormState>) {
    setFormState(prev => (prev ? { ...prev, ...partial } : prev));
  }

  function updateSteps(mutator: (steps: IncidentPlaybookStep[]) => IncidentPlaybookStep[]) {
    setFormState(prev => (prev ? { ...prev, steps: mutator(prev.steps || []) } : prev));
  }

  function updateContacts(
    mutator: (contacts: IncidentPlaybookContact[]) => IncidentPlaybookContact[]
  ) {
    setFormState(prev => (prev ? { ...prev, contacts: mutator(prev.contacts || []) } : prev));
  }

  async function savePlaybook() {
    if (!formState) return;
    try {
      setSaving(true);
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) throw new Error('Missing admin session');

      const method = playbooks.some(pb => pb.id === formState.id) ? 'PUT' : 'POST';
      const url =
        method === 'POST'
          ? '/api/admin/playbooks'
          : `/api/admin/playbooks/${formState.id}`;

      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formState),
      });

      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to save playbook');

      await loadPlaybooks();
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Unable to save playbook');
    } finally {
      setSaving(false);
    }
  }

  async function deletePlaybook(playbookId: string) {
    if (!confirm('Delete this playbook?')) return;
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) throw new Error('Missing admin session');

      const response = await fetch(`/api/admin/playbooks/${playbookId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Unable to delete playbook');

      setSelectedId(null);
      setFormState(null);
      await loadPlaybooks();
    } catch (err: any) {
      setError(err.message || 'Unable to delete playbook');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[340px,1fr]">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col min-h-[520px]">
        <button
          onClick={startNewPlaybook}
          className="w-full inline-flex items-center justify-center px-4 py-3 rounded-xl bg-gradient-to-r from-green-600 to-green-500 text-white font-medium shadow hover:from-green-700 hover:to-green-600 transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Playbook
        </button>

        <div className="mt-4 flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto pr-1 space-y-3">
            {playbooks.map(playbook => {
              const active = selectedId === playbook.id;
              return (
                <div
                  key={playbook.id}
                  onClick={() => onSelect(playbook)}
                  className={`rounded-xl border cursor-pointer transition group ${
                    active
                      ? 'border-green-500 bg-green-50 shadow-sm'
                      : 'border-gray-200 bg-white hover:border-green-300 hover:shadow'
                  }`}
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <h4 className="text-sm font-semibold text-gray-900 leading-snug pr-2">
                        {playbook.title}
                      </h4>
                      <span
                        className={`text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                          active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500 group-hover:bg-green-50 group-hover:text-green-600'
                        }`}
                      >
                        {playbook.species ? playbook.species : playbook.risk_level}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2 line-clamp-3">
                      {playbook.description || 'No description provided.'}
                    </p>
                  </div>
                </div>
              );
            })}
            {playbooks.length === 0 && (
              <div className="text-center text-sm text-gray-500 py-12 border border-dashed border-gray-200 rounded-xl">
                No playbooks yet. Click “New Playbook” to create your first SOP.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 min-h-[560px]">
        {formState ? (
          <div className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Playbook Title
                </label>
                <input
                  type="text"
                  value={formState.title}
                  onChange={e => updateForm({ title: e.target.value })}
                  className="w-full border rounded-md px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Risk Level
                </label>
                <select
                  className="w-full border rounded-md px-3 py-2"
                  value={formState.risk_level}
                  onChange={e => updateForm({ risk_level: e.target.value })}
                >
                  {riskOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Species (optional)
                </label>
                <input
                  type="text"
                  value={formState.species ?? ''}
                  onChange={e => updateForm({ species: e.target.value })}
                  className="w-full border rounded-md px-3 py-2"
                  placeholder="e.g., Russell's Viper"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Situation Brief
              </label>
              <textarea
                value={formState.description ?? ''}
                onChange={e => updateForm({ description: e.target.value })}
                className="w-full border rounded-md px-3 py-2"
                rows={2}
                placeholder="Context, hazards, or reminders for responders"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Aid Guidance
              </label>
              <textarea
                value={formState.first_aid ?? ''}
                onChange={e => updateForm({ first_aid: e.target.value })}
                className="w-full border rounded-md px-3 py-2"
                rows={3}
                placeholder="Instructions to relay to villagers/victims"
              />
            </div>

            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <ClipboardList className="h-5 w-5 text-green-600" />
                  <h3 className="font-semibold text-gray-900">Checklist Steps</h3>
                </div>
                <button
                  onClick={() =>
                    updateSteps(prev => [
                      ...prev,
                      {
                        id: generateId(),
                        title: 'New step',
                        description: '',
                      },
                    ])
                  }
                  className="inline-flex items-center text-sm text-green-600 hover:text-green-700"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Step
                </button>
              </div>

              <div className="space-y-3">
                {formState.steps.map((step, index) => (
                  <div
                    key={step.id}
                    className="border rounded-lg p-3 bg-white shadow-sm relative"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold uppercase text-gray-500">
                        Step {index + 1}
                      </span>
                      <button
                        onClick={() =>
                          updateSteps(prev => prev.filter(item => item.id !== step.id))
                        }
                        className="text-gray-400 hover:text-red-500"
                        title="Remove step"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={step.title}
                      onChange={e =>
                        updateSteps(prev =>
                          prev.map(item =>
                            item.id === step.id ? { ...item, title: e.target.value } : item
                          )
                        )
                      }
                      className="w-full border rounded-md px-3 py-2 mb-2"
                      placeholder="Step title"
                    />
                    <textarea
                      value={step.description ?? ''}
                      onChange={e =>
                        updateSteps(prev =>
                          prev.map(item =>
                            item.id === step.id
                              ? { ...item, description: e.target.value }
                              : item
                          )
                        )
                      }
                      className="w-full border rounded-md px-3 py-2 text-sm"
                      rows={2}
                      placeholder="Details or instructions"
                    />
                  </div>
                ))}
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <Users className="h-5 w-5 text-blue-600" />
                  <h3 className="font-semibold text-gray-900">Contact Tree</h3>
                </div>
                <button
                  onClick={() =>
                    updateContacts(prev => [
                      ...prev,
                      {
                        id: generateId(),
                        name: 'New contact',
                        role: '',
                        phone: '',
                        email: '',
                      },
                    ])
                  }
                  className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Contact
                </button>
              </div>

              <div className="space-y-3">
                {formState.contacts.map(contact => (
                  <div key={contact.id} className="border rounded-lg p-3 bg-white shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <input
                        type="text"
                        value={contact.name}
                        onChange={e =>
                          updateContacts(prev =>
                            prev.map(item =>
                              item.id === contact.id ? { ...item, name: e.target.value } : item
                            )
                          )
                        }
                        className="w-full border rounded-md px-3 py-2 mr-2"
                        placeholder="Name"
                      />
                      <button
                        onClick={() =>
                          updateContacts(prev => prev.filter(item => item.id !== contact.id))
                        }
                        className="text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid md:grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={contact.role ?? ''}
                        onChange={e =>
                          updateContacts(prev =>
                            prev.map(item =>
                              item.id === contact.id ? { ...item, role: e.target.value } : item
                            )
                          )
                        }
                        className="border rounded-md px-3 py-2"
                        placeholder="Role / Team"
                      />
                      <input
                        type="tel"
                        value={contact.phone ?? ''}
                        onChange={e =>
                          updateContacts(prev =>
                            prev.map(item =>
                              item.id === contact.id ? { ...item, phone: e.target.value } : item
                            )
                          )
                        }
                        className="border rounded-md px-3 py-2"
                        placeholder="Phone"
                      />
                      <input
                        type="email"
                        value={contact.email ?? ''}
                        onChange={e =>
                          updateContacts(prev =>
                            prev.map(item =>
                              item.id === contact.id ? { ...item, email: e.target.value } : item
                            )
                          )
                        }
                        className="border rounded-md px-3 py-2"
                        placeholder="Email"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="flex items-center justify-between">
              <button
                onClick={() => formState && deletePlaybook(formState.id)}
                className="inline-flex items-center text-sm text-red-500 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete Playbook
              </button>

              <button
                disabled={saving || !isDirty}
                onClick={savePlaybook}
                className={`inline-flex items-center px-4 py-2 rounded-md font-medium ${
                  isDirty
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 text-gray-500 border rounded-lg">
            <div className="text-center space-y-2 px-6">
              <Shield className="h-8 w-8 mx-auto text-gray-400" />
              <p>Select a playbook to edit or create a new one.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

