/* layout.js – Injects sidebar + topbar into .app-shell pages */

(function () {
  // Auth guard
  if (!localStorage.getItem('token')) {
    window.location.href = '/index.html';
    return;
  }

  var userName = localStorage.getItem('preecode_name') || 'User';
  var displayName = userName.charAt(0).toUpperCase() + userName.slice(1);
  var currentPage = window.location.pathname.split('/').pop().replace('.html', '');

  function linkCls(page) {
    var base = 'flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 no-underline';
    if (currentPage === page) {
      return base + ' text-[#ffa116] bg-white/[0.04] md:border-l-[3px] md:border-l-[#ffa116] md:rounded-l-none';
    }
    return base + ' text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] md:border-l-[3px] md:border-l-transparent md:hover:translate-x-0.5';
  }

  // Sidebar
  var sidebar = document.createElement('aside');
  sidebar.className = 'w-full relative flex flex-row items-center border-b border-white/[0.06] overflow-x-auto ' +
    'md:fixed md:top-0 md:left-0 md:bottom-0 md:w-[230px] md:flex-col md:items-stretch md:border-b-0 md:border-r md:border-white/[0.06] md:overflow-visible ' +
    'bg-white/[0.03] backdrop-blur-md z-50';

  sidebar.innerHTML =
    '<a class="flex items-center gap-2.5 px-5 py-4 md:pt-5 md:pb-7 no-underline text-zinc-100 shrink-0" href="/pages/dashboard.html">' +
      '<span class="text-lg font-extrabold text-[#ffa116] font-mono tracking-tight">&lt;/&gt;</span>' +
      '<span class="text-base font-bold tracking-tight">Preecode</span>' +
    '</a>' +
    '<nav class="flex flex-row md:flex-col gap-0.5 px-2 md:px-2.5 flex-1">' +
      '<a href="/pages/dashboard.html" class="' + linkCls('dashboard') + '">' +
        '<svg class="w-[18px] h-[18px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>' +
        '<span class="hidden md:inline">Dashboard</span>' +
      '</a>' +
      '<a href="/pages/problems.html" class="' + linkCls('problems') + '">' +
        '<svg class="w-[18px] h-[18px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 14l2 2 4-4"/></svg>' +
        '<span class="hidden md:inline">Problems</span>' +
      '</a>' +
      '<a href="/pages/submissions.html" class="' + linkCls('submissions') + '">' +
        '<svg class="w-[18px] h-[18px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="9"/></svg>' +
        '<span class="hidden md:inline">Submissions</span>' +
      '</a>' +
      '<a href="/pages/profile.html" class="' + linkCls('profile') + '">' +
        '<svg class="w-[18px] h-[18px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' +
        '<span class="hidden md:inline">Profile</span>' +
      '</a>' +
    '</nav>' +
    '<div class="shrink-0 px-2 md:px-2.5 md:py-2.5 md:border-t md:border-white/[0.06] border-l md:border-l-0 border-white/[0.06]">' +
      '<a href="#" class="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-sm font-medium text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 no-underline" id="logoutBtn">' +
        '<svg class="w-[18px] h-[18px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>' +
        '<span class="hidden md:inline">Logout</span>' +
      '</a>' +
    '</div>';

  // Topbar
  var topbar = document.createElement('header');
  topbar.className = 'h-14 bg-[rgba(22,22,26,0.85)] backdrop-blur-xl border-b border-white/[0.06] flex items-center justify-between px-4 md:px-7 sticky top-0 z-40';

  // Plan badge text
  var plan = localStorage.getItem('preecode_plan') || 'pro';
  var badge = localStorage.getItem('preecode_badge') || 'basic';
  var planText = plan === 'pro' ? (badge === 'elite' ? 'Pro \u2022 Elite' : 'Pro \u2022 Early Access') : 'Free';

  topbar.innerHTML =
    '<h1 class="text-base font-semibold text-zinc-100 tracking-tight">Hi ' + displayName + '</h1>' +
    '<div class="flex items-center gap-3">' +
      '<span class="nav-plan-badge pro" id="navPlanBadge">' + planText + '</span>' +
      '<span class="inline-flex items-center gap-1.5 px-3.5 py-1 bg-[rgba(255,161,22,0.1)] border border-[rgba(255,161,22,0.3)] rounded-full text-xs font-semibold text-[#ffa116] animate-streak-pulse" id="streakBadge">0 day streak</span>' +
    '</div>'

  // Inject
  var shell = document.querySelector('.app-shell');
  if (shell) {
    var main = shell.querySelector('.app-main');
    shell.insertBefore(sidebar, main);
    if (main) {
      main.insertBefore(topbar, main.firstChild);
    }
  }

  // Logout handler
  var logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function (e) {
      e.preventDefault();
      localStorage.removeItem('token');
      localStorage.removeItem('preecode_uid');
      localStorage.removeItem('preecode_name');
      localStorage.removeItem('preecode_plan');
      localStorage.removeItem('preecode_badge');
      localStorage.removeItem('preecode_shared');
      localStorage.removeItem('preecode_new');
      window.location.href = '/index.html';
    });
  }

  // Hydrate missing profile fields (common after OAuth callback) so top-right name is correct.
  (async function hydrateUser() {
    try {
      var token = localStorage.getItem('token');
      if (!token) return;

      var cachedName = localStorage.getItem('preecode_name') || '';
      if (cachedName && cachedName.toLowerCase() !== 'user') return;

      var res = await fetch('https://preecode.onrender.com/api/users/me', {
        headers: { Authorization: 'Bearer ' + token },
        credentials: 'include'
      });
      if (!res.ok) return;

      var me = await res.json();
      if (me && me._id) localStorage.setItem('preecode_uid', me._id);

      var resolvedName = '';
      if (me && me.username) {
        resolvedName = me.username;
      } else if (me && me.email && me.email.indexOf('@') !== -1) {
        resolvedName = me.email.split('@')[0];
      }

      if (resolvedName) {
        localStorage.setItem('preecode_name', resolvedName);
        var el = document.getElementById('navUserName');
        if (el) {
          el.textContent = resolvedName.charAt(0).toUpperCase() + resolvedName.slice(1);
        }
      }

      if (me && me.plan) localStorage.setItem('preecode_plan', me.plan);
      if (me && me.foundingBadgeLevel) localStorage.setItem('preecode_badge', me.foundingBadgeLevel);
      if (me && me.hasShared !== undefined) localStorage.setItem('preecode_shared', me.hasShared);
    } catch (e) {
      // Ignore hydrate errors and keep existing UI fallback
    }
  })();
})();
