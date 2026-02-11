export function clearSupabaseSession() {
  console.log('🧹 Clearing all Supabase session data...');

  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('sb-')) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach(key => {
    console.log('  Removing localStorage:', key);
    localStorage.removeItem(key);
  });

  const cookiesToRemove = document.cookie.split(';').map(c => c.trim());
  cookiesToRemove.forEach(cookie => {
    const cookieName = cookie.split('=')[0];
    if (cookieName.startsWith('sb-')) {
      console.log('  Removing cookie:', cookieName);
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;
      const parts = window.location.hostname.split('.');
      if (parts.length > 1) {
        const domain = parts.slice(-2).join('.');
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${domain};`;
      }
    }
  });

  sessionStorage.clear();

  console.log('✓ Session cleared successfully');
}

export function shouldResetSession(): boolean {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('reset') === 'true';
}

export function redirectWithReset() {
  const currentPath = window.location.pathname;
  window.location.href = `${currentPath}?reset=true`;
}
