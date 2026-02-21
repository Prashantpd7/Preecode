/* problems.js – Populates the Problems page from submissions data */

(function () {
  var userId = localStorage.getItem('preecode_uid');
  if (!userId) return;

  var allProblems = [];

  function emptyHtml(icon, title, desc, btnText, btnHref) {
    var h = '<div class="empty-state">' +
      '<span class="empty-icon">' + icon + '</span>' +
      '<span class="empty-title">' + title + '</span>' +
      '<span class="empty-desc">' + desc + '</span>';
    if (btnText && btnHref) {
      h += '<a href="' + btnHref + '" class="empty-cta">' + btnText + '</a>';
    }
    return h + '</div>';
  }

  Api.getSubmissions(userId)
    .then(function (subs) {
      var map = {};
      (subs || []).forEach(function (s) {
        var key = s.problemName;
        if (!map[key]) {
          map[key] = { name: s.problemName, difficulty: s.difficulty || 'easy', tags: s.tags || [], solved: false };
        }
        if (s.status === 'accepted') map[key].solved = true;
      });
      allProblems = Object.keys(map).map(function (k) { return map[k]; });
      render(allProblems);
    })
    .catch(function (err) { console.error('Problems load failed:', err); });

  var searchInput = document.getElementById('searchInput');
  var searchClear = document.getElementById('searchClear');
  var diffFilter  = document.getElementById('difficultyFilter');
  var topicFilter = document.getElementById('topicFilter');

  if (searchInput) searchInput.addEventListener('input', applyFilters);
  if (diffFilter)  diffFilter.addEventListener('change', applyFilters);
  if (topicFilter) topicFilter.addEventListener('change', applyFilters);

  // Search clear button
  if (searchClear && searchInput) {
    searchClear.addEventListener('click', function () {
      searchInput.value = '';
      searchInput.focus();
      applyFilters();
    });
  }

  function applyFilters() {
    var q = (searchInput ? searchInput.value : '').toLowerCase();
    var d = diffFilter  ? diffFilter.value  : '';
    var t = topicFilter ? topicFilter.value  : '';

    // Toggle active class on filters
    if (diffFilter)  diffFilter.classList.toggle('active', !!d);
    if (topicFilter) topicFilter.classList.toggle('active', !!t);

    render(allProblems.filter(function (p) {
      if (q && p.name.toLowerCase().indexOf(q) === -1) return false;
      if (d && p.difficulty !== d) return false;
      if (t && p.tags.indexOf(t) === -1) return false;
      return true;
    }));
  }

  function render(problems) {
    var tbody = document.getElementById('problemsBody');
    var countEl = document.getElementById('problemCount');
    if (!tbody) return;
    if (countEl) countEl.textContent = problems.length;

    if (!problems.length) {
      tbody.innerHTML = '<tr><td colspan="5">' + emptyHtml('&#128269;', 'No problems found', 'Try adjusting your filters or solve some problems to see them here.', 'Go to Dashboard', '/pages/dashboard.html') + '</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    problems.forEach(function (p, i) {
      var dc = p.difficulty || 'easy';
      var tags = (p.tags || []).map(function (t) {
        return '<span class="inline-block px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[11px] text-zinc-400 font-medium">' + escHtml(t) + '</span>';
      }).join(' ') || '<span class="text-zinc-600">&mdash;</span>';

      var solved = p.solved
        ? '<span class="text-emerald-400 font-bold">&#10003;</span>'
        : '<span class="text-zinc-600">&mdash;</span>';

      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + (i + 1) + '</td>' +
        '<td>' + escHtml(p.name) + '</td>' +
        '<td><span class="diff-badge ' + dc + '">' + cap(dc) + '</span></td>' +
        '<td>' + tags + '</td>' +
        '<td>' + solved + '</td>';
      tbody.appendChild(tr);
    });
  }

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function escHtml(s) { var d = document.createElement('div'); d.appendChild(document.createTextNode(s || '')); return d.innerHTML; }
})();
