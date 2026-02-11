import { ReactNode, useState, useMemo } from 'react';
import { LayoutDashboard, Inbox, Users, Settings, LogOut, Menu, X, Building2, UserCog, Link, UsersRound } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { isIndependiSubdomain, isSuperAdminDomain } from '../../utils/subdomain';

interface AdminLayoutProps {
  children: ReactNode;
  currentView: 'dashboard' | 'inbox' | 'clients' | 'team' | 'settings' | 'brokerages' | 'users' | 'invitations';
  onNavigate: (view: 'dashboard' | 'inbox' | 'clients' | 'team' | 'settings' | 'brokerages' | 'users' | 'invitations') => void;
}

export default function AdminLayout({ children, currentView, onNavigate }: AdminLayoutProps) {
  const { signOut, isSuperAdmin, userRole, user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const onIndependiSubdomain = isIndependiSubdomain();
  const onSuperAdminDomain = isSuperAdminDomain();

  const navItems = useMemo(() => {
    const baseItems = [
      { id: 'dashboard' as const, icon: LayoutDashboard, label: 'Dashboard' },
      { id: 'inbox' as const, icon: Inbox, label: 'All Claims' },
      { id: 'clients' as const, icon: Users, label: 'Clients' },
      { id: 'team' as const, icon: UsersRound, label: 'Team' },
    ];

    // ADMIN OVERRIDE: vickypingo@gmail.com always gets super admin menu items
    const isSuperAdminEmail = user?.email === 'vickypingo@gmail.com';

    // CRITICAL: On Independi subdomain, NEVER show super admin menu items
    // EXCEPT for vickypingo@gmail.com who always has full access
    // Only show super admin items if on super admin domain AND role is super_admin
    const isActualSuperAdmin = isSuperAdmin() && userRole === 'super_admin' && (onSuperAdminDomain || isSuperAdminEmail) && (!onIndependiSubdomain || isSuperAdminEmail);
    console.log('AdminLayout - Menu Items Calculation:');
    console.log('  Is Actual Super Admin:', isActualSuperAdmin);
    console.log('  Is Super Admin Email:', isSuperAdminEmail);
    console.log('  User Email:', user?.email);
    console.log('  User Role:', userRole);
    console.log('  On Independi Subdomain:', onIndependiSubdomain);
    console.log('  On Super Admin Domain:', onSuperAdminDomain);

    if (isActualSuperAdmin) {
      baseItems.push({ id: 'brokerages' as const, icon: Building2, label: 'Organisations' });
      baseItems.push({ id: 'users' as const, icon: UserCog, label: 'Users' });
      baseItems.push({ id: 'invitations' as const, icon: Link, label: 'Invitations' });
      baseItems.push({ id: 'settings' as const, icon: Settings, label: 'Admin Settings' });
    }

    return baseItems;
  }, [isSuperAdmin, userRole, user, onIndependiSubdomain, onSuperAdminDomain]);

  const handleNavigate = (view: 'dashboard' | 'inbox' | 'clients' | 'team' | 'settings' | 'brokerages' | 'users' | 'invitations') => {
    onNavigate(view);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <header className="md:hidden bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Broker Admin</h1>
            <p className="text-xs text-gray-600">Claims Management</p>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex w-64 bg-white border-r border-gray-200 flex-col fixed h-screen">
          <div className="p-6 border-b border-gray-200">
            <h1 className="text-xl font-bold text-gray-900">Broker Admin</h1>
            <p className="text-sm text-gray-600 mt-1">Claims Management</p>
          </div>

          <nav className="flex-1 p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-blue-700' : 'text-gray-500'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="p-4 border-t border-gray-200">
            <button
              onClick={signOut}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-gray-700 hover:bg-gray-50 transition-all"
            >
              <LogOut className="w-5 h-5 text-gray-500" />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* Mobile Sidebar Drawer */}
        <aside
          className={`md:hidden fixed top-0 left-0 h-screen w-64 bg-white border-r border-gray-200 flex flex-col z-50 transform transition-transform duration-300 ease-in-out ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Broker Admin</h1>
              <p className="text-sm text-gray-600 mt-1">Claims Management</p>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-1 rounded-lg text-gray-700 hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigate(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-blue-700' : 'text-gray-500'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="p-4 border-t border-gray-200">
            <button
              onClick={signOut}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-gray-700 hover:bg-gray-50 transition-all"
            >
              <LogOut className="w-5 h-5 text-gray-500" />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 md:ml-64 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
