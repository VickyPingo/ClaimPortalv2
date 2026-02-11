import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Users, Search, Shield, Trash2, Edit, Mail, Phone, Building2 } from 'lucide-react';

interface User {
  id: string;
  email: string;
  full_name: string;
  cell_number?: string;
  role: string;
  brokerage_id: string;
  brokerage_name?: string;
  created_at: string;
}

export default function UsersManager() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    console.log('👥 UsersManager component mounted - fetching users');
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      // Load broker users
      const { data: brokerData, error: brokerError } = await supabase
        .from('broker_profiles')
        .select(`
          id,
          full_name,
          cell_number,
          role,
          brokerage_id,
          created_at,
          brokerages (name)
        `)
        .order('created_at', { ascending: false });

      if (brokerError) throw brokerError;

      // Load client users
      const { data: clientData, error: clientError } = await supabase
        .from('client_profiles')
        .select(`
          id,
          full_name,
          cell_number,
          role,
          brokerage_id,
          created_at,
          brokerages (name)
        `)
        .order('created_at', { ascending: false });

      if (clientError) console.error('Error fetching client data:', clientError);

      // Get auth.users emails for both brokers and clients
      const allIds = [
        ...(brokerData?.map(b => b.id) || []),
        ...(clientData?.map(c => c.id) || [])
      ];

      const { data: authData, error: authError } = await supabase
        .from('users')
        .select('id, email')
        .in('id', allIds);

      if (authError) console.error('Error fetching auth data:', authError);

      const emailMap = new Map(authData?.map(u => [u.id, u.email]) || []);

      // Format broker users
      const formattedBrokers: User[] = (brokerData || []).map(broker => ({
        id: broker.id,
        email: emailMap.get(broker.id) || 'N/A',
        full_name: broker.full_name,
        cell_number: broker.cell_number,
        role: broker.role || 'broker',
        brokerage_id: broker.brokerage_id,
        brokerage_name: (broker.brokerages as any)?.name || 'Unknown',
        created_at: broker.created_at,
      }));

      // Format client users
      const formattedClients: User[] = (clientData || []).map(client => ({
        id: client.id,
        email: emailMap.get(client.id) || 'N/A',
        full_name: client.full_name,
        cell_number: client.cell_number,
        role: client.role || 'client',
        brokerage_id: client.brokerage_id,
        brokerage_name: (client.brokerages as any)?.name || 'Unknown',
        created_at: client.created_at,
      }));

      // Combine and sort by created_at
      const allUsers = [...formattedBrokers, ...formattedClients].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setUsers(allUsers);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (userId: string, userEmail: string) => {
    // Protect vickypingo@gmail.com from deletion
    if (userEmail === 'vickypingo@gmail.com') {
      alert('Cannot delete the super admin account (vickypingo@gmail.com)');
      return;
    }

    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      // Delete from broker_profiles
      const { error: profileError } = await supabase
        .from('broker_profiles')
        .delete()
        .eq('id', userId);

      if (profileError) {
        console.error('Error deleting broker_profiles:', profileError);
      }

      // Delete from broker_users
      const { error: brokerUserError } = await supabase
        .from('broker_users')
        .delete()
        .eq('id', userId);

      if (brokerUserError) {
        console.error('Error deleting broker_users:', brokerUserError);
      }

      // Delete from client_profiles (in case it's a client)
      const { error: clientError } = await supabase
        .from('client_profiles')
        .delete()
        .eq('id', userId);

      if (clientError) {
        console.error('Error deleting client_profiles:', clientError);
      }

      console.log('✓ User deleted successfully');

      alert('User deleted successfully');
      loadUsers();
    } catch (error: any) {
      console.error('Failed to delete user:', error);
      alert('Failed to delete user: ' + error.message);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.brokerage_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-700 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Users className="w-8 h-8 text-blue-700" />
                Users Management
              </h1>
              <p className="text-gray-600 mt-2">
                Manage all user accounts across the platform
              </p>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search users by name, email, or brokerage..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-transparent"
            />
          </div>
        </div>

        {filteredUsers.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {searchTerm ? 'No users found' : 'No users yet'}
            </h3>
            <p className="text-gray-600">
              {searchTerm
                ? 'Try adjusting your search term'
                : 'Users will appear here once they register'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Brokerage
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Joined
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-700 font-semibold text-sm">
                              {user.full_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{user.full_name}</p>
                            <p className="text-sm text-gray-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {user.cell_number && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Phone className="w-4 h-4" />
                            {user.cell_number}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Building2 className="w-4 h-4" />
                          {user.brokerage_name}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                            user.role?.toLowerCase() === 'super_admin'
                              ? 'bg-purple-100 text-purple-700'
                              : user.role?.toLowerCase() === 'admin'
                              ? 'bg-blue-100 text-blue-700'
                              : user.role?.toLowerCase() === 'broker'
                              ? 'bg-blue-100 text-blue-700'
                              : user.role?.toLowerCase() === 'client'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {user.role?.toLowerCase() === 'super_admin' && <Shield className="w-3 h-3" />}
                          {user.role?.toLowerCase() === 'super_admin'
                            ? 'Super Admin'
                            : user.role?.toLowerCase() === 'admin'
                            ? 'Admin'
                            : user.role?.toLowerCase() === 'broker'
                            ? 'Broker'
                            : user.role?.toLowerCase() === 'client'
                            ? 'Client'
                            : user.role || 'Unknown'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => deleteUser(user.id, user.email)}
                            className={`p-2 rounded-lg transition-colors ${
                              user.email === 'vickypingo@gmail.com'
                                ? 'text-gray-300 cursor-not-allowed'
                                : 'text-red-600 hover:bg-red-50'
                            }`}
                            title={
                              user.email === 'vickypingo@gmail.com'
                                ? 'Cannot delete super admin'
                                : 'Delete user'
                            }
                            disabled={user.email === 'vickypingo@gmail.com'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-6 text-center text-sm text-gray-500">
          Showing {filteredUsers.length} of {users.length} users
        </div>
      </div>
    </div>
  );
}
