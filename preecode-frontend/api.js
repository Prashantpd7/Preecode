/* api.js – preecode API helper */

var API_BASE = 'https://preecode-backend.onrender.com/api';

var Api = {
  // Login user
  login: function (email, password) {
    return fetch(API_BASE + '/users/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: email, password: password }),
    }).then(function (res) {
      if (!res.ok) return res.json().then(function (d) { throw new Error(d.message || 'Login failed'); });
      return res.json();
    }).then(function (data) {
      if (data.token) localStorage.setItem('token', data.token);
      return data;
    }).catch(function (err) {
      if (err instanceof TypeError) throw new Error('Network error — could not reach server');
      throw err;
    });
  },

  // Register a new user
  register: function (username, email, password) {
    return fetch(API_BASE + '/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username: username, email: email, password: password }),
    }).then(function (res) {
      if (!res.ok) return res.json().then(function (d) { throw new Error(d.message || 'Registration failed'); });
      return res.json();
    }).then(function (data) {
      if (data.token) localStorage.setItem('token', data.token);
      return data;
    }).catch(function (err) {
      if (err instanceof TypeError) throw new Error('Network error — could not reach server');
      throw err;
    });
  },

  // Get user profile by ID
  getUser: function (userId) {
    return fetch(API_BASE + '/users/' + userId, {
      headers: Api._authHeaders(),
      credentials: 'include',
    }).then(function (res) {
      if (!res.ok) return res.json().then(function (d) { throw new Error(d.message || 'Failed to fetch user'); });
      return res.json();
    });
  },

  // Get dashboard stats + recent submissions
  getStats: function (userId) {
    return fetch(API_BASE + '/users/stats/' + userId, {
      headers: Api._authHeaders(),
      credentials: 'include',
    }).then(function (res) {
      if (!res.ok) return res.json().then(function (d) { throw new Error(d.message || 'Failed to fetch stats'); });
      return res.json();
    });
  },

  // Add a submission
  addSubmission: function (userId, problemName, difficulty, status) {
    return fetch(API_BASE + '/submissions', {
      method: 'POST',
      headers: Api._authHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify({
        userId: userId,
        problemName: problemName,
        difficulty: difficulty,
        status: status,
      }),
    }).then(function (res) {
      if (!res.ok) return res.json().then(function (d) { throw new Error(d.message || 'Failed to add submission'); });
      return res.json();
    });
  },

  // Get all submissions for a user
  getSubmissions: function (userId) {
    return fetch(API_BASE + '/submissions/' + userId, {
      headers: Api._authHeaders(),
      credentials: 'include',
    }).then(function (res) {
      if (!res.ok) return res.json().then(function (d) { throw new Error(d.message || 'Failed to fetch submissions'); });
      return res.json();
    });
  },

  // Get practice sessions for a user
  getPractice: function () {
    return fetch(API_BASE + '/practice', {
      headers: Api._authHeaders(),
      credentials: 'include',
    }).then(function (res) {
      if (!res.ok) return res.json().then(function (d) { throw new Error(d.message || 'Failed to fetch practice data'); });
      return res.json();
    });
  },

  // AI Chat
  chatWithAI: function (message, context) {
    return fetch(API_BASE + '/ai/chat', {
      method: 'POST',
      headers: Api._authHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify({ message: message, context: context }),
    }).then(function (res) {
      if (!res.ok) return res.json().then(function (d) { throw new Error(d.message || 'AI chat failed'); });
      return res.json();
    });
  },

  // AI Hint
  getAIHint: function (problemDescription, language) {
    return fetch(API_BASE + '/ai/hint', {
      method: 'POST',
      headers: Api._authHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify({ problemDescription: problemDescription, language: language }),
    }).then(function (res) {
      if (!res.ok) return res.json().then(function (d) { throw new Error(d.message || 'AI hint failed'); });
      return res.json();
    });
  },

  // AI Code Review
  reviewCode: function (code, language, problemDescription) {
    return fetch(API_BASE + '/ai/review', {
      method: 'POST',
      headers: Api._authHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify({ code: code, language: language, problemDescription: problemDescription }),
    }).then(function (res) {
      if (!res.ok) return res.json().then(function (d) { throw new Error(d.message || 'AI review failed'); });
      return res.json();
    });
  },

  // Get early access status
  getEarlyAccessStatus: function () {
    return fetch(API_BASE + '/early-access/status', {
      headers: Api._authHeaders(),
      credentials: 'include',
    }).then(function (res) {
      if (!res.ok) return res.json().then(function (d) { throw new Error(d.message || 'Failed to fetch early access status'); });
      return res.json();
    });
  },

  // Confirm share for elite status
  confirmShare: function () {
    return fetch(API_BASE + '/early-access/confirm-share', {
      method: 'POST',
      headers: Api._authHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify({}),
    }).then(function (res) {
      if (!res.ok) return res.json().then(function (d) { throw new Error(d.message || 'Failed to confirm share'); });
      return res.json();
    });
  },

  // Build headers with Authorization token
  _authHeaders: function (extra) {
    var headers = {};
    var token = localStorage.getItem('token');
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (extra) {
      for (var key in extra) headers[key] = extra[key];
    }
    return headers;
  },
};
