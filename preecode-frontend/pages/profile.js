/* profile.js – Profile page (Premium V2) */

(function () {
  var userId = localStorage.getItem('preecode_uid');
  var userName = localStorage.getItem('preecode_name') || 'User';
  if (!userId) return;

  var displayName = userName.charAt(0).toUpperCase() + userName.slice(1);

  // ── Animate numbers ──
  function animateNumber(el, target, duration) {
    if (!el) return;
    duration = duration || 800;
    target = parseInt(target, 10) || 0;
    if (target === 0) { el.textContent = '0'; return; }
    var start = null;
    function ease(t) { return 1 - Math.pow(1 - t, 3); }
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      el.textContent = Math.round(ease(p) * target);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // ── Avatar initial ──
  var avatar = document.getElementById('profileAvatar');
  if (avatar) avatar.textContent = displayName.charAt(0);
  setText('profileName', displayName);

  // ── Shared state for profile completion ──
  var profileState = { user: null, stats: { total: 0, streak: 0 } };

  // ── Fetch user profile ──
  Api.getUser(userId)
    .then(function (user) {
      profileState.user = user;
      if (user.username) setText('profileName', cap(user.username));
      if (user.email) setText('profileEmail', user.email);
      if (user.username) {
        var av = document.getElementById('profileAvatar');
        if (av) av.textContent = user.username.charAt(0).toUpperCase();
      }

      // Member since
      if (user.createdAt) {
        var d = new Date(user.createdAt);
        var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        setText('memberSince', 'Member since ' + months[d.getMonth()] + ' ' + d.getFullYear());
      }

      // Founding badge
      var badgeEl = document.getElementById('foundingBadge');
      if (badgeEl && user.plan === 'pro') {
        badgeEl.style.display = '';
        var level = user.foundingBadgeLevel || localStorage.getItem('preecode_badge') || 'basic';
        badgeEl.className = 'founding-badge ' + level;
        var badgeTextEl = document.getElementById('foundingBadgeText');
        if (badgeTextEl) {
          badgeTextEl.textContent = level === 'elite' ? 'Founding Member' : 'Early Access';
        }
      }

      updateProfileCompletion();
    })
    .catch(function () {
      setText('profileEmail', '\u2014');
    });

  // ── Fetch early access status ──
  Api.getEarlyAccessStatus()
    .then(function (data) {
      var card = document.getElementById('eaStatusCard');
      if (!card) return;
      card.style.display = '';

      var label = document.getElementById('eaPlanLabel');
      if (label) label.textContent = data.subscriptionStatus === 'active' ? 'Active' : 'Expired';

      var days = document.getElementById('eaDaysLeft');
      var dr = data.daysRemaining || 0;
      if (days) {
        days.textContent = dr > 0 ? dr + ' days remaining' : 'Expired';
      }

      // Progress bar (dynamic period based on earlyAccessMonthsGranted)
      var totalDays = (data.earlyAccessMonthsGranted || 3) * 30;
      var elapsed = totalDays - dr;
      var progressBar = document.getElementById('eaProgressBar');
      if (progressBar && dr > 0) {
        var pct = Math.min((elapsed / totalDays) * 100, 100);
        setTimeout(function () {
          progressBar.style.width = pct.toFixed(1) + '%';
        }, 300);
      }

      // Update progress labels dynamically
      var leftLabel = card.querySelector('.ea-progress-left');
      var rightLabel = card.querySelector('.ea-progress-right');
      if (leftLabel) leftLabel.textContent = elapsed + ' days used';
      if (rightLabel) rightLabel.textContent = totalDays + ' days total';

      var certLink = document.getElementById('viewCertLink');
      if (certLink && data.foundingBadgeLevel === 'elite') {
        certLink.style.display = '';
      }
    })
    .catch(function () {});

  // ── Fetch stats ──
  Api.getStats(userId)
    .then(function (data) {
      var total = data.totalSolved || 0;
      var easy = data.easySolved || 0;
      var medium = data.mediumSolved || 0;
      var hard = data.hardSolved || 0;
      var points = data.points || (easy * 1 + medium * 3 + hard * 5);
      var streak = data.streak || 0;

      profileState.stats = { total: total, streak: streak };

      // Main stats
      animateNumber(document.getElementById('profileTotal'), total);
      animateNumber(document.getElementById('profilePoints'), points);
      animateNumber(document.getElementById('profileStreak'), streak);

      // Micro stats
      animateNumber(document.getElementById('microSolved'), total);
      animateNumber(document.getElementById('microStreak'), streak);
      animateNumber(document.getElementById('microPoints'), points);

      // Difficulty breakdown with percentages
      animateNumber(document.getElementById('pEasyCount'), easy);
      animateNumber(document.getElementById('pMedCount'), medium);
      animateNumber(document.getElementById('pHardCount'), hard);
      setBar('pEasyBar', easy, total || 1);
      setBar('pMedBar', medium, total || 1);
      setBar('pHardBar', hard, total || 1);

      var ePct = total > 0 ? Math.round((easy / total) * 100) : 0;
      var mPct = total > 0 ? Math.round((medium / total) * 100) : 0;
      var hPct = total > 0 ? Math.round((hard / total) * 100) : 0;
      setText('pEasyPct', ePct + '%');
      setText('pMedPct', mPct + '%');
      setText('pHardPct', hPct + '%');

      // Streak badge in topbar
      var streakBadge = document.getElementById('streakBadge');
      if (streakBadge) streakBadge.textContent = streak + ' day streak';

      // Badge progress
      updateBadge('badgeFirstBar', 'badgeFirstText', total, 1, ' solved');
      updateBadge('badge7day', 'badge7dayText', streak, 7, ' days');
      updateBadge('badge50', 'badge50Text', total, 50, ' solved');
      updateBadge('badgeHard', 'badgeHardText', hard, 10, ' hard');

      // Unlock badges
      unlockBadge('firstSolve', total >= 1);
      unlockBadge('7day', streak >= 7);
      unlockBadge('50problems', total >= 50);
      unlockBadge('hardMaster', hard >= 10);

      // Rank / Level
      updateRank(points);

      // Profile completion (update with stats)
      updateProfileCompletion();
    })
    .catch(function (err) {
      console.error('Profile stats load failed:', err);
    });

  // ── Activity heatmap (last 7 days) ──
  buildActivityHeatmap();

  // ── Helpers ──
  function setText(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function setBar(id, value, max) {
    var el = document.getElementById(id);
    if (el && max > 0) {
      setTimeout(function () {
        el.style.width = ((value / max) * 100).toFixed(1) + '%';
      }, 150);
    }
  }

  function updateBadge(barId, textId, current, goal, suffix) {
    var bar = document.getElementById(barId);
    var text = document.getElementById(textId);
    var pct = Math.min((current / goal) * 100, 100);
    if (bar) {
      setTimeout(function () { bar.style.width = pct.toFixed(1) + '%'; }, 200);
    }
    if (text) text.textContent = Math.min(current, goal) + '/' + goal + suffix;
  }

  function unlockBadge(badgeName, earned) {
    var card = document.querySelector('[data-badge="' + badgeName + '"]');
    if (!card) return;
    if (earned) {
      card.classList.remove('locked');
      card.classList.add('unlocked');
    } else {
      card.classList.add('locked');
      card.classList.remove('unlocked');
    }
  }

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // ── Rank System ──
  function updateRank(points) {
    var ranks = [
      { name: 'Beginner',     min: 0,    max: 49,       level: 1 },
      { name: 'Apprentice',   min: 50,   max: 149,      level: 2 },
      { name: 'Intermediate', min: 150,  max: 299,      level: 3 },
      { name: 'Advanced',     min: 300,  max: 499,      level: 4 },
      { name: 'Expert',       min: 500,  max: 999,      level: 5 },
      { name: 'Master',       min: 1000, max: Infinity,  level: 6 }
    ];

    var rank = ranks[0];
    for (var i = 0; i < ranks.length; i++) {
      if (points >= ranks[i].min) rank = ranks[i];
    }

    setText('rankName', 'Level ' + rank.level + ' \u2014 ' + rank.name);
    var nextMax = rank.max === Infinity ? rank.min + 500 : rank.max + 1;
    var progress = ((points - rank.min) / (nextMax - rank.min)) * 100;
    setText('rankXP', points + ' / ' + nextMax + ' XP');

    var rankIcon = document.getElementById('rankIcon');
    if (rankIcon) rankIcon.textContent = rank.level;

    var rankBar = document.getElementById('rankBar');
    if (rankBar) {
      setTimeout(function () {
        rankBar.style.width = Math.min(progress, 100).toFixed(1) + '%';
      }, 300);
    }
  }

  // ── Profile Completion ──
  function updateProfileCompletion() {
    var user = profileState.user;
    if (!user) return;
    var stats = profileState.stats;

    var checks = [
      { label: 'Username set', done: !!(user.username && user.username !== 'User') },
      { label: 'Email verified', done: !!user.email },
      { label: 'Avatar uploaded', done: !!(user.avatar || localStorage.getItem('preecode_avatar')) },
      { label: 'First problem solved', done: stats.total > 0 },
      { label: 'Streak started', done: stats.streak > 0 }
    ];

    var doneCount = 0;
    var html = '';
    for (var i = 0; i < checks.length; i++) {
      if (checks[i].done) doneCount++;
      html += '<div class="completion-item ' + (checks[i].done ? 'done' : '') + '">' +
        '<span class="completion-check ' + (checks[i].done ? 'done' : 'pending') + '">' +
        (checks[i].done ? '&#10003;' : '') +
        '</span>' +
        '<span>' + checks[i].label + '</span></div>';
    }

    var checklist = document.getElementById('completionChecklist');
    if (checklist) checklist.innerHTML = html;

    var pct = Math.round((doneCount / checks.length) * 100);
    setText('completionPct', pct + '%');

    // Animate SVG circle
    var circle = document.getElementById('completionCircle');
    if (circle) {
      var circumference = 2 * Math.PI * 34;
      var offset = circumference - (pct / 100) * circumference;
      setTimeout(function () {
        circle.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)';
        circle.setAttribute('stroke-dashoffset', offset);
      }, 400);
    }
  }

  // ── Activity Heatmap ──
  function buildActivityHeatmap() {
    var container = document.getElementById('activityHeatmap');
    if (!container) return;

    var today = new Date();
    var dayOfWeek = today.getDay();
    var adjusted = (dayOfWeek + 6) % 7;

    if (Api.getSubmissions) {
      Api.getSubmissions(userId)
        .then(function (subs) {
          var counts = [0, 0, 0, 0, 0, 0, 0];
          var now = new Date();
          for (var i = 0; i < subs.length; i++) {
            var sd = new Date(subs[i].createdAt || subs[i].date);
            var diff = Math.floor((now - sd) / (1000 * 60 * 60 * 24));
            if (diff < 7 && diff >= 0) {
              counts[6 - diff]++;
            }
          }
          renderHeatmap(container, counts, adjusted);
        })
        .catch(function () {
          renderHeatmap(container, [0, 0, 0, 0, 0, 0, 0], adjusted);
        });
    } else {
      renderHeatmap(container, [0, 0, 0, 0, 0, 0, 0], adjusted);
    }
  }

  function renderHeatmap(container, counts, todayIdx) {
    var dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    var html = '';
    for (var i = 0; i < 7; i++) {
      var c = counts[i] || 0;
      var level = c === 0 ? '' : c <= 1 ? 'l1' : c <= 2 ? 'l2' : c <= 3 ? 'l3' : 'l4';
      var dayIndex = (todayIdx - 6 + i + 7) % 7;
      html += '<div class="activity-heatmap-day">' +
        '<div class="activity-heatmap-cell ' + level + '" title="' + c + ' submissions"></div>' +
        '<span class="activity-heatmap-label">' + dayNames[dayIndex] + '</span>' +
        '</div>';
    }
    container.innerHTML = html;
  }

  // ── Edit Profile Modal ──
  var editModal = document.getElementById('editProfileModal');
  var editBtn = document.getElementById('editProfileBtn');
  var closeBtn = document.getElementById('closeEditModal');
  var cancelBtn = document.getElementById('cancelEditModal');
  var editForm = document.getElementById('editProfileForm');
  var usernameInput = document.getElementById('editUsername');
  var avatarInput = document.getElementById('editAvatar');

  function openEditModal() {
    usernameInput.value = userName;
    avatarInput.value = localStorage.getItem('preecode_avatar') || '';
    editModal.classList.remove('hidden');
  }

  function closeEditModalFn() {
    editModal.classList.add('hidden');
  }

  editBtn.addEventListener('click', openEditModal);
  closeBtn.addEventListener('click', closeEditModalFn);
  cancelBtn.addEventListener('click', closeEditModalFn);

  editForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    var newUsername = usernameInput.value.trim();
    var newAvatar = avatarInput.value.trim();

    if (!newUsername) {
      alert('Username cannot be empty');
      return;
    }

    try {
      var result = await Api.updateProfile({
        username: newUsername,
        avatar: newAvatar || undefined
      });

      if (result && result.user) {
        localStorage.setItem('preecode_name', result.user.username);
        if (result.user.avatar) {
          localStorage.setItem('preecode_avatar', result.user.avatar);
        }
        setText('profileName', cap(result.user.username));
        var av = document.getElementById('profileAvatar');
        if (av) av.textContent = result.user.username.charAt(0).toUpperCase();
        closeEditModalFn();
        location.reload();
      }
    } catch (err) {
      alert('Failed to update profile: ' + (err.message || 'Unknown error'));
    }
  });

  editModal.addEventListener('click', function (e) {
    if (e.target === editModal) closeEditModalFn();
  });

  // ── Theme Selector (with System support) ──
  var themeSelector = document.getElementById('themeSelector');
  if (themeSelector && window.PreeCodeTheme) {
    var themeOptions = themeSelector.querySelectorAll('.theme-option');

    function syncThemeUI() {
      var current = PreeCodeTheme.get();
      themeOptions.forEach(function (btn) {
        if (btn.getAttribute('data-theme-value') === current) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }

    syncThemeUI();

    themeOptions.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var value = btn.getAttribute('data-theme-value');
        PreeCodeTheme.set(value);
        syncThemeUI();
      });
    });
  }

  // ── Logout with confirmation modal ──
  var logoutBtn = document.getElementById('profileLogoutBtn');
  var logoutModal = document.getElementById('logoutModal');
  var cancelLogoutBtn = document.getElementById('cancelLogout');
  var confirmLogoutBtn = document.getElementById('confirmLogout');

  if (logoutBtn && logoutModal) {
    logoutBtn.addEventListener('click', function (e) {
      e.preventDefault();
      logoutModal.classList.remove('hidden');
    });

    cancelLogoutBtn.addEventListener('click', function () {
      logoutModal.classList.add('hidden');
    });

    logoutModal.addEventListener('click', function (e) {
      if (e.target === logoutModal) logoutModal.classList.add('hidden');
    });

    confirmLogoutBtn.addEventListener('click', function () {
      localStorage.removeItem('token');
      localStorage.removeItem('preecode_uid');
      localStorage.removeItem('preecode_name');
      localStorage.removeItem('preecode_plan');
      localStorage.removeItem('preecode_badge');
      localStorage.removeItem('preecode_shared');
      localStorage.removeItem('preecode_new');
      localStorage.removeItem('preecode_avatar');
      window.location.href = '/index.html';
    });
  }
})();
