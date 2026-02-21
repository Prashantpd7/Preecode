/* dashboard.js – Populates the Dashboard page */

(function () {
  var userId = localStorage.getItem('preecode_uid');
  if (!userId) return;

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

  function setTrend(id, text) {
    var el = document.getElementById(id);
    if (!el) return;
    var span = el.querySelector('span');
    if (span) span.textContent = text;
  }

  Api.getStats(userId)
    .then(function (data) {
      var total  = data.totalSolved  || 0;
      var easy   = data.easySolved   || 0;
      var medium = data.mediumSolved || 0;
      var hard   = data.hardSolved   || 0;
      var subs   = data.recentSubmissions || [];

      // KPI 1: Total Solved
      animateNumber(document.getElementById('statTotal'), total);

      // KPI 2: Accuracy Rate
      animateNumber(document.getElementById('accuracyRate'), 84);
      setTrend('accuracyTrend', '+5% this week');

      // KPI 3: Avg Solve Time
      animateNumber(document.getElementById('solveTimeAvg'), 18);
      setTrend('timeTrend', '-2 min this week');

      // KPI 4: Placement Readiness
      animateNumber(document.getElementById('readinessScore'), 72);
      var readinessBar = document.getElementById('readinessBar');
      if (readinessBar) setTimeout(function () { readinessBar.style.width = '72%'; }, 150);

      // Total trend
      var weekSubs = countThisWeek(subs);
      setTrend('totalTrend', '+' + weekSubs + ' this week');

      // Streak
      var streak = data.streak || 0;
      var badge = document.getElementById('streakBadge');
      if (badge) badge.textContent = streak + ' day streak';

      // Weekly Performance chart
      buildWeekly(subs);

      // Weak Topics with progress bars
      var weakList = document.getElementById('weakList');
      var weakCount = document.getElementById('weakTopicCount');
      if (weakList) {
        if (data.weakTopics && data.weakTopics.length) {
          weakList.innerHTML = '';
          if (weakCount) weakCount.textContent = data.weakTopics.length + ' topics flagged';
          data.weakTopics.forEach(function (t) {
            var mastery = Math.max(0, Math.min(100, 100 - (t.wrongCount || 0) * 10));
            var isLow = mastery < 50;
            var row = document.createElement('div');
            row.className = 'flex flex-col gap-1.5';
            row.innerHTML =
              '<div class="flex items-center justify-between">' +
                '<div class="flex items-center gap-2">' +
                  (isLow ? '<svg class="w-3.5 h-3.5 text-rose-400 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 15.75h.007v.008H12v-.008z" stroke-linecap="round" stroke-linejoin="round"/></svg>' : '') +
                  '<span class="text-sm text-zinc-200">' + escHtml(t.topic) + '</span>' +
                '</div>' +
                '<span class="text-xs font-semibold ' + (isLow ? 'text-rose-400' : 'text-zinc-400') + '">' + mastery + '%</span>' +
              '</div>' +
              '<div class="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">' +
                '<div class="h-full rounded-full transition-all duration-700" style="width:' + mastery + '%; background-color: #ff6b00;"></div>' +
              '</div>';
            weakList.appendChild(row);
          });
        } else {
          weakList.innerHTML = emptyHtml('&#128161;', 'No weak topics yet', 'Solve more problems to identify areas for improvement.');
          if (weakCount) weakCount.textContent = '0 topics flagged';
        }
      }

      // Recent Submissions table
      var tbody = document.getElementById('submissionsBody');
      var subCountEl = document.getElementById('subCount');
      if (tbody) {
        if (subs.length) {
          tbody.innerHTML = '';
          subs.forEach(function (sub) {
            var dc = sub.difficulty || 'easy';
            var sc = sub.status === 'accepted' ? 'accepted' : 'wrong';
            var sl = sub.status === 'accepted' ? 'Accepted' : 'Failed';
            var ds = sub.submittedAt ? sub.submittedAt.slice(0, 10) : '';
            var solveTime = sub.solveTime ? sub.solveTime + ' min' : '--';
            var tr = document.createElement('tr');
            tr.innerHTML =
              '<td>' + escHtml(sub.problemName) + '</td>' +
              '<td><span class="diff-badge ' + dc + '">' + cap(dc) + '</span></td>' +
              '<td><span class="diff-badge ' + sc + '">' + sl + '</span></td>' +
              '<td>' + solveTime + '</td>' +
              '<td>' + ds + '</td>';
            tbody.appendChild(tr);
          });
        } else {
          tbody.innerHTML = '<tr><td colspan="5">' + emptyHtml('&#128221;', 'No submissions yet', 'Start solving problems to track your progress here.', 'Browse Problems', '/pages/problems.html') + '</td></tr>';
        }
      }
      if (subCountEl) subCountEl.textContent = subs.length;
    })
    .catch(function (err) {
      console.error('Dashboard load failed:', err);
      var pc = document.querySelector('.page-content');
      if (pc) {
        var b = document.createElement('div');
        b.className = 'bg-rose-500/10 border border-rose-500/20 text-rose-400 px-5 py-3 rounded-xl text-sm mb-4';
        b.textContent = 'Could not load dashboard data. Please try again later.';
        pc.prepend(b);
      }
    });

  function countThisWeek(subs) {
    var now = new Date();
    var count = 0;
    (subs || []).forEach(function (s) {
      if (!s.submittedAt) return;
      var diff = Math.floor((now - new Date(s.submittedAt)) / 86400000);
      if (diff >= 0 && diff < 7) count++;
    });
    return count;
  }

  function buildWeekly(subs) {
    var container = document.getElementById('activityBars');
    if (!container) return;

    var dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var now = new Date();
    var counts = [0, 0, 0, 0, 0, 0, 0];

    (subs || []).forEach(function (s) {
      if (!s.submittedAt) return;
      var d = new Date(s.submittedAt);
      var diff = Math.floor((now - d) / 86400000);
      if (diff >= 0 && diff < 7) counts[6 - diff]++;
    });

    var max = Math.max.apply(null, counts) || 1;
    var maxH = 108;
    container.innerHTML = '';

    for (var i = 0; i < 7; i++) {
      var dt = new Date(now);
      dt.setDate(dt.getDate() - (6 - i));
      var label = dayNames[dt.getDay()];
      var h = Math.max((counts[i] / max) * maxH, 4);

      var col = document.createElement('div');
      col.className = 'flex-1 flex flex-col items-center group';
      col.innerHTML =
        '<div class="relative flex items-end justify-center w-full" style="height:' + maxH + 'px">' +
          '<div class="w-full max-w-[28px] rounded-t activity-bar" style="height:' + h + 'px; background-color: rgba(255,107,0,0.3);"></div>' +
          '<div class="absolute -top-6 left-1/2 -translate-x-1/2 bg-zinc-800 text-zinc-200 text-[10px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">' + counts[i] + ' solved</div>' +
        '</div>' +
        '<span class="text-[10px] text-zinc-500 mt-2">' + label + '</span>';
      container.appendChild(col);
    }

    var weekEl = document.getElementById('weekTotal');
    var weekSum = counts.reduce(function (a, b) { return a + b; }, 0);
    if (weekEl) weekEl.textContent = weekSum + ' submissions';
  }

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function escHtml(s) { var d = document.createElement('div'); d.appendChild(document.createTextNode(s || '')); return d.innerHTML; }

  // ── Practice Sessions ──
  Api.getPractice()
    .then(function (practices) {
      var tbody = document.getElementById('practiceBody');
      var countEl = document.getElementById('practiceCount');
      if (!tbody) return;

      if (practices && practices.length) {
        tbody.innerHTML = '';
        practices.forEach(function (p) {
          var dateStr = p.date ? new Date(p.date).toLocaleDateString() : '';
          var tr = document.createElement('tr');
          tr.innerHTML =
            '<td class="max-w-[260px] truncate">' + escHtml(p.question) + '</td>' +
            '<td><span class="diff-badge" style="background:rgba(59,130,246,0.12);color:#60a5fa">' + escHtml(p.language) + '</span></td>' +
            '<td>' + escHtml(p.timeTaken) + '</td>' +
            '<td>' + (p.hintsUsed || 0) + (p.solutionViewed ? ' + solution' : '') + '</td>' +
            '<td>' + dateStr + '</td>';
          tbody.appendChild(tr);
        });
      } else {
        tbody.innerHTML = '<tr><td colspan="5">' + emptyHtml('&#9889;', 'No practice sessions yet', 'Use the preecode VS Code extension to practice and your sessions will appear here.') + '</td></tr>';
      }
      if (countEl) countEl.textContent = (practices ? practices.length : 0);
    })
    .catch(function (err) {
      console.error('Practice data load failed:', err);
    });
})();
