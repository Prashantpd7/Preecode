/* app.js – Auth handlers (login + register) */

// ── PASSWORD TOGGLE ─────────────────────────────────────
document.querySelectorAll('.pw-toggle').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var wrapper = btn.closest('.relative');
    var input = wrapper.querySelector('input');
    var eyeOpen = btn.querySelector('.pw-eye-open');
    var eyeClosed = btn.querySelector('.pw-eye-closed');

    if (input.type === 'password') {
      input.type = 'text';
      eyeOpen.classList.add('hidden');
      eyeClosed.classList.remove('hidden');
    } else {
      input.type = 'password';
      eyeOpen.classList.remove('hidden');
      eyeClosed.classList.add('hidden');
    }
  });
});

// ── LOGIN PAGE ───────────────────────────────────────────
var loginForm = document.getElementById('loginForm');
if (loginForm) {
  // Already logged in → go to dashboard
  if (localStorage.getItem('token')) {
    window.location.href = '/pages/dashboard.html';
  }

  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var emailInput = document.getElementById('email');
    var passInput  = document.getElementById('password');
    var email      = emailInput.value.trim();
    var password   = passInput.value;
    var errorMsg   = document.getElementById('errorMsg');
    var submitBtn  = loginForm.querySelector('button[type="submit"]');
    var btnText    = document.getElementById('btnText');
    var btnSpinner = document.getElementById('btnSpinner');

    // Clear previous error styles
    emailInput.classList.remove('border-red-500');
    passInput.classList.remove('border-red-500');

    if (!email || !password) {
      errorMsg.textContent = 'Please enter your email and password.';
      if (!email) emailInput.classList.add('border-red-500');
      if (!password) passInput.classList.add('border-red-500');
      return;
    }

    errorMsg.textContent = '';
    submitBtn.disabled = true;
    if (btnText) btnText.classList.add('hidden');
    if (btnSpinner) btnSpinner.classList.remove('hidden');

    Api.login(email, password)
      .then(function (data) {
          localStorage.setItem('token', data.token);
        localStorage.setItem('preecode_uid', data._id || data.user._id);
        localStorage.setItem('preecode_name', data.username || data.user.username);
        if (data.plan) localStorage.setItem('preecode_plan', data.plan);
        if (data.foundingBadgeLevel) localStorage.setItem('preecode_badge', data.foundingBadgeLevel);
        if (data.hasShared !== undefined) localStorage.setItem('preecode_shared', data.hasShared);
        // If login page was opened with a redirect (e.g. extension deep link),
        // forward the token to that redirect so the extension receives the JWT.
        try {
          var urlParams = new URLSearchParams(window.location.search);
          var redirectTarget = urlParams.get('redirect');
          if (redirectTarget) {
            try {
              redirectTarget = decodeURIComponent(redirectTarget);
            } catch (e) {
              // ignore if not encoded
            }
            // Append token as query param and navigate — this will trigger
            // the vscode URI handler inside VS Code when opened by the user.
            var sep = redirectTarget.indexOf('?') === -1 ? '?' : '&';
            window.location.href = redirectTarget + sep + 'token=' + encodeURIComponent(data.token);
            return;
          }
        } catch (e) {
          /* ignore and fall through to dashboard */
        }

        window.location.href = '/pages/dashboard.html';
      })
      .catch(function (err) {
        errorMsg.textContent = err.message || 'Login failed. Check your credentials.';
        submitBtn.disabled = false;
        if (btnText) { btnText.classList.remove('hidden'); }
        if (btnSpinner) { btnSpinner.classList.add('hidden'); }
      });
  });
}

// ── REGISTER PAGE ────────────────────────────────────────
var registerForm = document.getElementById('registerForm');
if (registerForm) {
  // Already logged in → go to dashboard
  if (localStorage.getItem('token')) {
    window.location.href = '/pages/dashboard.html';
  }

  registerForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var emailInput = document.getElementById('email');
    var passInput  = document.getElementById('password');
    var email      = emailInput.value.trim();
    var password   = passInput.value;
    var errorMsg   = document.getElementById('errorMsg');
    var submitBtn  = registerForm.querySelector('button[type="submit"]');
    var btnText    = document.getElementById('regBtnText');
    var btnSpinner = document.getElementById('regBtnSpinner');

    // Clear previous error styles
    emailInput.classList.remove('border-red-500');
    passInput.classList.remove('border-red-500');

    if (!email || !password) {
      errorMsg.textContent = 'Please enter your email and password.';
      if (!email) emailInput.classList.add('border-red-500');
      if (!password) passInput.classList.add('border-red-500');
      return;
    }

    var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errorMsg.textContent = 'Please enter a valid email address.';
      emailInput.classList.add('border-red-500');
      return;
    }

    if (password.length < 6) {
      errorMsg.textContent = 'Password must be at least 6 characters.';
      passInput.classList.add('border-red-500');
      return;
    }

    errorMsg.textContent = '';
    submitBtn.disabled = true;
    if (btnText) btnText.classList.add('hidden');
    if (btnSpinner) btnSpinner.classList.remove('hidden');

    // Auto-derive username from email
    var username = email.split('@')[0];

    Api.register(username, email, password)
      .then(function (data) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('preecode_uid', data._id || data.user._id);
        localStorage.setItem('preecode_name', data.username || data.user.username);
        if (data.plan) localStorage.setItem('preecode_plan', data.plan);
        if (data.foundingBadgeLevel) localStorage.setItem('preecode_badge', data.foundingBadgeLevel);
        if (data.hasShared !== undefined) localStorage.setItem('preecode_shared', data.hasShared);
        if (data.isNewUser) localStorage.setItem('preecode_new', 'true');
        window.location.href = '/pages/dashboard.html';
      })
      .catch(function (err) {
        errorMsg.textContent = err.message || 'Registration failed. Try again.';
        submitBtn.disabled = false;
        if (btnText) { btnText.classList.remove('hidden'); }
        if (btnSpinner) { btnSpinner.classList.add('hidden'); }
      });
  });
}
