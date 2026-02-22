/* profile.js – Populates the Profile page */

(function () {
  var userId   = localStorage.getItem('preecode_uid');
  var userName = localStorage.getItem('preecode_name') || 'User';
  if (!userId) return;

  var displayName = userName.charAt(0).toUpperCase() + userName.slice(1);

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

  // Avatar initial
  var avatar = document.getElementById('profileAvatar');
  if (avatar) avatar.textContent = displayName.charAt(0);

  // Name placeholder
  setText('profileName', displayName);

  // Fetch user profile
  Api.getUser(userId)
    .then(function (user) {
      if (user.username) setText('profileName', cap(user.username));
      if (user.email)    setText('profileEmail', user.email);
      if (user.username) {
        var av = document.getElementById('profileAvatar');
        if (av) av.textContent = user.username.charAt(0).toUpperCase();
      }

      // Founding badge
      var badgeEl = document.getElementById('foundingBadge');
      if (badgeEl && user.plan === 'pro') {
        badgeEl.style.display = '';
        var level = user.foundingBadgeLevel || localStorage.getItem('preecode_badge') || 'basic';
        badgeEl.className = 'founding-badge ' + level;
        var badgeTextEl = document.getElementById('foundingBadgeText');
        if (badgeTextEl) {
          badgeTextEl.textContent = level === 'elite' ? 'Elite Founding Member' : 'Founding Member';
        }
      }
    })
    .catch(function () {
      setText('profileEmail', '—');
    });

  // Fetch early access status
  Api.getEarlyAccessStatus()
    .then(function (data) {
      var card = document.getElementById('eaStatusCard');
      if (!card) return;
      card.style.display = '';

      var label = document.getElementById('eaPlanLabel');
      if (label) label.textContent = data.subscriptionStatus === 'active' ? 'Active' : 'Expired';

      var days = document.getElementById('eaDaysLeft');
      if (days) {
        var dr = data.daysRemaining || 0;
        days.textContent = dr > 0 ? dr + ' days remaining' : 'Expired';
      }

      var certLink = document.getElementById('viewCertLink');
      if (certLink && data.foundingBadgeLevel === 'elite') {
        certLink.style.display = '';
      }
    })
    .catch(function () {
      // Silently ignore - card stays hidden
    });

  // Fetch stats
  Api.getStats(userId)
    .then(function (data) {
      var total  = data.totalSolved  || 0;
      var easy   = data.easySolved   || 0;
      var medium = data.mediumSolved || 0;
      var hard   = data.hardSolved   || 0;
      var points = data.points || (easy * 1 + medium * 3 + hard * 5);
      var streak = data.streak || 0;

      animateNumber(document.getElementById('profileTotal'),  total);
      animateNumber(document.getElementById('profilePoints'), points);
      animateNumber(document.getElementById('profileStreak'), streak);

      // Difficulty breakdown bars
      animateNumber(document.getElementById('pEasyCount'), easy);
      animateNumber(document.getElementById('pMedCount'),  medium);
      animateNumber(document.getElementById('pHardCount'), hard);
      setBar('pEasyBar', easy, total || 1);
      setBar('pMedBar',  medium, total || 1);
      setBar('pHardBar', hard, total || 1);

      // Streak badge in topbar
      var streakBadge = document.getElementById('streakBadge');
      if (streakBadge) streakBadge.textContent = streak + ' day streak';

      // Badge progress indicators
      updateBadge('badgeFirstBar', 'badgeFirstText', total, 1, ' solved');
      updateBadge('badge7day', 'badge7dayText', streak, 7, ' days');
      updateBadge('badge50', 'badge50Text', total, 50, ' solved');
      updateBadge('badgeHard', 'badgeHardText', hard, 10, ' hard');

      // Unlock badges (toggle locked/unlocked classes)
      unlockBadge('firstSolve', total >= 1);
      unlockBadge('7day', streak >= 7);
      unlockBadge('50problems', total >= 50);
      unlockBadge('hardMaster', hard >= 10);
    })
    .catch(function (err) {
      console.error('Profile stats load failed:', err);
    });

  // Helpers
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
    var bar  = document.getElementById(barId);
    var text = document.getElementById(textId);
    var pct  = Math.min((current / goal) * 100, 100);
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

  // Edit Profile Modal handling
  var editModal = document.getElementById('editProfileModal');
  var editBtn = document.getElementById('editProfileBtn');
  var closeBtn = document.getElementById('closeEditModal');
  var cancelBtn = document.getElementById('cancelEditModal');
  var editForm = document.getElementById('editProfileForm');
  var usernameInput = document.getElementById('editUsername');
  var avatarInput = document.getElementById('editAvatar');

  function openEditModal() {
    // Populate current values
    usernameInput.value = userName;
    avatarInput.value = localStorage.getItem('preecode_avatar') || '';
    editModal.classList.remove('hidden');
  }

  function closeEditModal() {
    editModal.classList.add('hidden');
  }

  editBtn.addEventListener('click', openEditModal);
  closeBtn.addEventListener('click', closeEditModal);
  cancelBtn.addEventListener('click', closeEditModal);

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
        // Update local storage
        localStorage.setItem('preecode_name', result.user.username);
        if (result.user.avatar) {
          localStorage.setItem('preecode_avatar', result.user.avatar);
        }

        // Update UI
        setText('profileName', cap(result.user.username));
        var av = document.getElementById('profileAvatar');
        if (av) av.textContent = result.user.username.charAt(0).toUpperCase();

        alert('Profile updated successfully');
        closeEditModal();
        location.reload(); // Reload to update all pages
      }
    } catch (err) {
      alert('Failed to update profile: ' + (err.message || 'Unknown error'));
      console.error('Profile update error:', err);
    }
  });

  // Close modal on outside click
  editModal.addEventListener('click', function (e) {
    if (e.target === editModal) {
      closeEditModal();
    }
  });
})();
