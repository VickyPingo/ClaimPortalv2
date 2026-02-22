import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from '../../contexts/AuthContext';
import { useBrokerage } from '../../contexts/BrokerageContext';
import {
  Copy,
  Link as LinkIcon,
  Trash2,
  Calendar,
  Users,
  CheckCircle,
  AlertCircle,
  Plus,
  Loader,
  Mail
} from 'lucide-react';

interface Invitation {
  id: string;
  token: string;
  email: string | null;
  role: string;
  brokerage_id: string;
  expires_at: string;
  used_count: number;
  max_uses: number | null;
  is_active: boolean;
  created_at: string;
}

interface Brokerage {
  id: string;
  name: string;
  subdomain: string;
}

export default function InvitationManager() {
  const { brokerageId, isSuperAdmin } = useAuth();
  const { brokerage } = useBrokerage();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [brokerages, setBrokerages] = useState<Brokerage[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);

  const [newInvitation, setNewInvitation] = useState({
    brokerage_id: brokerageId || '',
    role: 'broker',
    email: '',
    daysValid: 7,
    maxUses: null as number | null,
  });

  useEffect(() => {
    loadInvitations();
    if (isSuperAdmin()) {
      loadBrokerages();
    }
  }, [brokerageId]);

  useEffect(() => {
    if (brokerageId && !newInvitation.brokerage_id) {
      setNewInvitation(prev => ({ ...prev, brokerage_id: brokerageId }));
    }
  }, [brokerageId]);

  const loadBrokerages = async () => {
    try {
      const { data, error } = await supabase
        .from('brokerages')
        .select('id, name, subdomain')
        .order('name');

      if (error) throw error;
      setBrokerages(data || []);
    } catch (error) {
      console.error('Error loading brokerages:', error);
    }
  };

  const loadInvitations = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('invitations')
        .select('*')
        .order('created_at', { ascending: false });

      // If not super admin, filter by brokerage
      if (!isSuperAdmin() && brokerageId) {
        query = query.eq('brokerage_id', brokerageId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setInvitations(data || []);
    } catch (error) {
      console.error('Error loading invitations:', error);
    } finally {
      setLoading(false);
    }
  };

  const createInvitation = async () => {
    // Validate email
    if (!newInvitation.email || !newInvitation.email.includes('@')) {
      alert('Please enter a valid email address');
      return;
    }

    // Validate brokerage selection
    if (!newInvitation.brokerage_id) {
      alert('Please select an organisation');
      return;
    }

    setCreating(true);
    try {
      // Create a fresh Supabase client to avoid schema cache issues
      const freshClient = createClient(
        import.meta.env.VITE_SUPABASE_URL!,
        import.meta.env.VITE_SUPABASE_ANON_KEY!
      );

      // Get current session and set it on fresh client
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await freshClient.auth.setSession(session);
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + newInvitation.daysValid);

      const token = crypto.randomUUID();

      console.log('📝 Creating invitation...');
      console.log('📧 Email:', newInvitation.email);
      console.log('🆔 Brokerage ID:', newInvitation.brokerage_id);

      // Create invitation in database
      const { data, error } = await freshClient
        .from('invitations')
        .insert([{
          email: newInvitation.email,
          brokerage_id: newInvitation.brokerage_id,
          role: newInvitation.role,
          token: token,
          expires_at: expiresAt.toISOString(),
          max_uses: newInvitation.maxUses,
          is_active: true,
          used_count: 0
        }])
        .select()
        .single();

      if (error) {
        console.error('❌ Failed to create invitation:', error);
        throw error;
      }

      console.log('✅ Invitation created successfully');

      // Generate invitation URL
      const selectedBrokerage = brokerages.find(b => b.id === newInvitation.brokerage_id);
      const brokerSlug = selectedBrokerage?.subdomain || newInvitation.brokerage_id;
      const invitationUrl = `${window.location.origin}/signup?token=${data.token}&brokerId=${brokerSlug}`;

      console.log('📧 Sending invitation email...');

      // Send invitation email via edge function
      try {
        const emailApiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-invitation-email`;
        console.log('Email API URL:', emailApiUrl);

        const emailResponse = await fetch(emailApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY!,
          },
          body: JSON.stringify({
            email: newInvitation.email,
            invitationUrl: invitationUrl,
            brokerageName: selectedBrokerage?.name || 'Unknown Brokerage',
            role: newInvitation.role,
            expiresAt: expiresAt.toISOString(),
          }),
        });

        console.log('Email response status:', emailResponse.status);

        if (!emailResponse.ok) {
          const errorText = await emailResponse.text();
          console.error('❌ Email API error response:', errorText);
          throw new Error(`Email API returned ${emailResponse.status}: ${errorText}`);
        }

        const emailResult = await emailResponse.json();
        console.log('Email result:', emailResult);

        if (!emailResult.success) {
          console.error('❌ Failed to send email:', emailResult.error);
          alert(`⚠️ Invitation created but email failed to send: ${emailResult.error}\n\nInvitation link: ${invitationUrl}`);
        } else {
          console.log('✅ Email sent successfully');
          alert(`✅ Invitation sent to ${newInvitation.email}!\n\nThe recipient will receive an email with instructions to sign up.`);
        }
      } catch (emailError: any) {
        console.error('❌ Error sending email:', emailError);
        alert(`⚠️ Invitation created but email service is unavailable: ${emailError.message}\n\nInvitation link: ${invitationUrl}\n\nYou can manually share this link with the user.`);
      }

      // Update invitations list
      setInvitations([data, ...invitations]);
      setShowCreateForm(false);
      setNewInvitation({
        brokerage_id: brokerageId || '',
        role: 'broker',
        email: '',
        daysValid: 7,
        maxUses: null
      });

    } catch (error: any) {
      console.error('❌ Error creating invitation:', error);
      alert('Failed to create invitation: ' + (error?.message || 'Unknown error'));
    } finally {
      setCreating(false);
    }
  };

  const deactivateInvitation = async (id: string) => {
    try {
      const { error } = await supabase
        .from('invitations')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      setInvitations(
        invitations.map((inv) =>
          inv.id === id ? { ...inv, is_active: false } : inv
        )
      );

      alert('✅ Invitation deauthorised successfully');
    } catch (error: any) {
      alert('Failed to deauthorise invitation: ' + error.message);
    }
  };

  const copyInvitationLink = (token: string, invitationBrokerageId: string) => {
    const baseUrl = window.location.origin;
    const brokerSlug = invitationBrokerageId === 'f67b67c8-086b-4b42-8d27-917a0783e9b0' ? 'independi' : invitationBrokerageId;
    const inviteUrl = `${baseUrl}/signup?token=${token}&brokerId=${brokerSlug}`;

    navigator.clipboard.writeText(inviteUrl);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const getInvitationUrl = (token: string, invitationBrokerageId: string) => {
    const baseUrl = window.location.origin;
    const brokerSlug = invitationBrokerageId === 'f67b67c8-086b-4b42-8d27-917a0783e9b0' ? 'independi' : invitationBrokerageId;
    return `${baseUrl}/signup?token=${token}&brokerId=${brokerSlug}`;
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  const isMaxedOut = (inv: Invitation) => {
    return inv.max_uses !== null && inv.used_count >= inv.max_uses;
  };

  const getBrokerageName = (brokerageId: string) => {
    const broker = brokerages.find(b => b.id === brokerageId);
    return broker ? broker.name : 'Unknown';
  };

  const resendInvitationEmail = async (invitation: Invitation) => {
    if (!invitation.email) {
      alert('No email address associated with this invitation');
      return;
    }

    setSendingEmail(invitation.id);
    try {
      const selectedBrokerage = brokerages.find(b => b.id === invitation.brokerage_id);
      const brokerSlug = selectedBrokerage?.subdomain || invitation.brokerage_id;
      const invitationUrl = `${window.location.origin}/signup?token=${invitation.token}&brokerId=${brokerSlug}`;

      console.log('📧 Resending invitation email to:', invitation.email);

      const emailApiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-invitation-email`;
      console.log('Email API URL:', emailApiUrl);

      const emailResponse = await fetch(emailApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY!,
        },
        body: JSON.stringify({
          email: invitation.email,
          invitationUrl: invitationUrl,
          brokerageName: selectedBrokerage?.name || 'Unknown Brokerage',
          role: invitation.role,
          expiresAt: invitation.expires_at,
        }),
      });

      console.log('Email response status:', emailResponse.status);

      if (!emailResponse.ok) {
        const errorText = await emailResponse.text();
        console.error('❌ Email API error response:', errorText);
        throw new Error(`Email API returned ${emailResponse.status}: ${errorText}`);
      }

      const emailResult = await emailResponse.json();
      console.log('Email result:', emailResult);

      if (!emailResult.success) {
        throw new Error(emailResult.error || 'Failed to send email');
      }

      alert(`✅ Invitation email resent to ${invitation.email}`);
    } catch (error: any) {
      console.error('❌ Error resending email:', error);
      alert(`Failed to resend email: ${error?.message || 'Unknown error'}\n\nInvitation link can be copied from the list.`);
    } finally {
      setSendingEmail(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="w-8 h-8 animate-spin text-blue-700" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Invitation Links</h2>
          <p className="text-gray-600 mt-1">
            Generate secure invitation links to authorise and onboard new team members
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Authorise New Broker
        </button>
      </div>

      {showCreateForm && (
        <div className="mb-6 p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">New Invitation</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-900 mb-2">
                Broker Email Address <span className="text-red-600">*</span>
              </label>
              <input
                type="email"
                value={newInvitation.email}
                onChange={(e) =>
                  setNewInvitation({ ...newInvitation, email: e.target.value })
                }
                placeholder="broker@example.com"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                required
              />
              <p className="text-xs text-gray-600 mt-1">
                An invitation email will be sent to this address
              </p>
            </div>

            {isSuperAdmin() && brokerages.length > 0 && (
              <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
                <label className="block text-sm font-bold text-blue-900 mb-2">
                  Select Organisation <span className="text-red-600">*</span>
                </label>
                <select
                  value={newInvitation.brokerage_id}
                  onChange={(e) => {
                    console.log('Brokerage selected:', e.target.value);
                    setNewInvitation({ ...newInvitation, brokerage_id: e.target.value });
                  }}
                  className="w-full px-4 py-3 border-2 border-blue-400 rounded-lg focus:ring-2 focus:ring-blue-600 bg-white font-medium text-gray-900"
                  required
                >
                  <option value="">Choose a brokerage organisation...</option>
                  {brokerages.map((broker) => (
                    <option key={broker.id} value={broker.id}>
                      {broker.name} ({broker.subdomain}.claimsportal.co.za)
                    </option>
                  ))}
                </select>
                <p className="text-xs text-blue-800 mt-2 font-medium">
                  The invitation will be sent to the selected organisation
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Role
              </label>
              <select
                value={newInvitation.role}
                onChange={(e) =>
                  setNewInvitation({ ...newInvitation, role: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="broker">Broker</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Valid for (days)
              </label>
              <input
                type="number"
                value={newInvitation.daysValid}
                onChange={(e) =>
                  setNewInvitation({
                    ...newInvitation,
                    daysValid: parseInt(e.target.value) || 7,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                min="1"
                max="365"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max uses (optional)
              </label>
              <input
                type="number"
                value={newInvitation.maxUses || ''}
                onChange={(e) =>
                  setNewInvitation({
                    ...newInvitation,
                    maxUses: e.target.value ? parseInt(e.target.value) : null,
                  })
                }
                placeholder="Unlimited"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                min="1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave empty for unlimited uses
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={createInvitation}
                disabled={creating || !newInvitation.email || !newInvitation.brokerage_id}
                className="flex-1 bg-blue-700 text-white py-2 rounded-lg hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold"
              >
                {creating && <Loader className="w-4 h-4 animate-spin" />}
                {creating ? 'Sending Invitation...' : 'Send Invitation Email'}
              </button>
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {invitations.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <LinkIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No invitations created yet</p>
            <p className="text-sm text-gray-500 mt-1">
              Create your first invitation to authorise and onboard team members
            </p>
          </div>
        ) : (
          invitations.map((invitation) => {
            const expired = isExpired(invitation.expires_at);
            const maxedOut = isMaxedOut(invitation);
            const inactive = !invitation.is_active || expired || maxedOut;

            return (
              <div
                key={invitation.id}
                className={`p-4 bg-white rounded-lg border ${
                  inactive ? 'border-gray-200 opacity-60' : 'border-gray-300'
                } shadow-sm`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          inactive
                            ? 'bg-gray-100 text-gray-600'
                            : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {inactive ? 'Inactive' : 'Active'}
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        {invitation.role.charAt(0).toUpperCase() +
                          invitation.role.slice(1)}
                      </span>
                      {isSuperAdmin() && (
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                          {getBrokerageName(invitation.brokerage_id)}
                        </span>
                      )}
                    </div>

                    {invitation.email && (
                      <div className="mb-2">
                        <span className="text-sm text-gray-700">
                          📧 {invitation.email}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        <span>
                          {invitation.used_count}
                          {invitation.max_uses ? `/${invitation.max_uses}` : ''} uses
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>
                          Expires {new Date(invitation.expires_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {expired && (
                      <div className="flex items-center gap-1 text-sm text-amber-600 mb-2">
                        <AlertCircle className="w-4 h-4" />
                        <span>Expired</span>
                      </div>
                    )}

                    {maxedOut && (
                      <div className="flex items-center gap-1 text-sm text-amber-600 mb-2">
                        <AlertCircle className="w-4 h-4" />
                        <span>Max uses reached</span>
                      </div>
                    )}

                    <div className="mt-2 p-2 bg-gray-50 rounded text-xs font-mono text-gray-700 break-all">
                      {getInvitationUrl(invitation.token, invitation.brokerage_id)}
                    </div>
                  </div>

                  <div className="flex gap-2 ml-4">
                    {invitation.email && invitation.is_active && !expired && !maxedOut && (
                      <button
                        onClick={() => resendInvitationEmail(invitation)}
                        disabled={sendingEmail === invitation.id}
                        className="p-2 text-blue-700 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Resend email"
                      >
                        {sendingEmail === invitation.id ? (
                          <Loader className="w-5 h-5 animate-spin" />
                        ) : (
                          <Mail className="w-5 h-5" />
                        )}
                      </button>
                    )}

                    <button
                      onClick={() => copyInvitationLink(invitation.token, invitation.brokerage_id)}
                      disabled={inactive}
                      className="p-2 text-blue-700 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Copy link"
                    >
                      {copiedToken === invitation.token ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <Copy className="w-5 h-5" />
                      )}
                    </button>

                    {invitation.is_active && !expired && !maxedOut && (
                      <button
                        onClick={() => deactivateInvitation(invitation.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Deauthorise invitation"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
