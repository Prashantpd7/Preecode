/* dashboard.js – Populates the Dashboard page (Premium V2) */

(function () {
  var userId = localStorage.getItem('preecode_uid');
  if (!userId) return;

  // ── Animate numbers with easing ──
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

  function setText(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  // ── Empty state with motivational text & CTA ──
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

  function setTrend(id, text, direction) {
    var el = document.getElementById(id);
    if (!el) return;
    var span = el.querySelector('span');
    if (span) span.textContent = text;
    if (direction) {
      el.className = 'dash-metric-trend ' + direction;
    }
  }

  // ── Rank System (shared with profile) ──
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

    setText('dashRankName', 'Level ' + rank.level + ' \u2014 ' + rank.name);
    var nextMax = rank.max === Infinity ? rank.min + 500 : rank.max + 1;
    var progress = ((points - rank.min) / (nextMax - rank.min)) * 100;
    setText('dashRankXP', points + ' / ' + nextMax + ' XP');

    var rankIcon = document.getElementById('dashRankIcon');
    if (rankIcon) rankIcon.textContent = rank.level;

    var rankBar = document.getElementById('dashRankBar');
    if (rankBar) {
      setTimeout(function () {
        rankBar.style.width = Math.min(progress, 100).toFixed(1) + '%';
      }, 300);
    }
  }

  // ── Streak display ──
  function updateStreak(streak) {
    var label = document.getElementById('dashStreakLabel');
    var msg = document.getElementById('dashStreakMsg');
    var badge = document.getElementById('dashStreakBadge');
    var flame = document.getElementById('dashStreakFlame');

    if (label) label.textContent = streak + ' Day Streak';
    if (badge) badge.textContent = streak;

    if (streak > 0 && flame) {
      flame.classList.add('active');
    }

    if (msg) {
      if (streak === 0) msg.textContent = 'Start solving to build a streak';
      else if (streak < 3) msg.textContent = 'Keep it going!';
      else if (streak < 7) msg.textContent = 'Great consistency!';
      else msg.textContent = 'You\'re on fire!';
    }

    // Topbar streak badge
    var topBadge = document.getElementById('streakText');
    if (topBadge) topBadge.textContent = streak;
  }

  // ── Hero: Continue Your Journey ──
  function buildHero(streak, points, total) {
    var hero = document.getElementById('dashHero');
    if (!hero) return;

    // Greeting based on time of day
    var hour = new Date().getHours();
    var greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    var name = localStorage.getItem('preecode_name') || '';
    if (name) {
      // Extract first name (split on space, camelCase, underscore)
      var first = name.replace(/([a-z])([A-Z])/g, '$1 $2').split(/[\s_]+/)[0];
      first = first.charAt(0).toUpperCase() + first.slice(1);
      greeting += ', ' + first;
    }

    var greetingEl = document.getElementById('heroGreeting');
    if (greetingEl) {
      greetingEl.innerHTML = '<span class="dash-hero-wave">&#x1F44B;</span> ' + greeting;
    }

    // Tagline varies by streak
    var tagline = 'Start your journey today.';
    if (streak >= 7) tagline = 'Incredible discipline \u2014 keep pushing!';
    else if (streak >= 3) tagline = 'Great consistency! You\'re building momentum.';
    else if (streak >= 1) tagline = 'Nice start! Keep the streak alive.';
    else if (total > 0) tagline = 'Welcome back \u2014 pick up where you left off.';

    var taglineEl = document.getElementById('heroTagline');
    if (taglineEl) taglineEl.textContent = tagline;

    // Streak pill
    var streakText = document.getElementById('heroStreakText');
    if (streakText) streakText.textContent = streak + ' day streak';

    // Level pill using same rank array
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

    var levelText = document.getElementById('heroLevelText');
    if (levelText) levelText.textContent = 'Level ' + rank.level + ' \u2014 ' + rank.name;

    // Progress bar to next rank
    var nextMax = rank.max === Infinity ? rank.min + 500 : rank.max + 1;
    var progress = ((points - rank.min) / (nextMax - rank.min)) * 100;
    var progressBar = document.getElementById('heroProgressBar');
    if (progressBar) {
      setTimeout(function () {
        progressBar.style.width = Math.min(progress, 100).toFixed(1) + '%';
      }, 400);
    }

    // Milestone text
    var milestoneEl = document.getElementById('heroMilestone');
    if (milestoneEl) {
      var xpLeft = nextMax - points;
      if (rank.max === Infinity) {
        milestoneEl.textContent = 'Max rank achieved \u2014 you\'re a Master!';
      } else {
        var nextRank = ranks[ranks.indexOf(rank) + 1];
        milestoneEl.textContent = xpLeft + ' XP until ' + (nextRank ? nextRank.name : 'next rank');
      }
    }

    // Show the hero
    hero.style.display = '';
  }

  // ── Main stats fetch ──
  Api.getStats(userId)
    .then(function (data) {
      var total  = data.totalSolved  || 0;
      var easy   = data.easySolved   || 0;
      var medium = data.mediumSolved || 0;
      var hard   = data.hardSolved   || 0;
      var subs   = data.recentSubmissions || [];
      var streak = data.streak || 0;
      var points = data.points || (easy * 1 + medium * 3 + hard * 5);

      var accepted = subs.filter(function (s) { return s.status === 'accepted'; }).length;
      var accuracy = subs.length ? Math.round((accepted / subs.length) * 100) : 0;

      // KPI 1: Total Solved
      animateNumber(document.getElementById('statTotal'), total);

      // KPI 2: Accuracy Rate
      animateNumber(document.getElementById('accuracyRate'), accuracy);
      setTrend('accuracyTrend', accepted + ' accepted / ' + subs.length + ' attempts', accuracy >= 50 ? 'up' : '');

      // KPI 3: Avg Solve Time (updated by practice fetch)
      animateNumber(document.getElementById('solveTimeAvg'), 0);

      // KPI 4: Placement Readiness
      var readiness = Math.max(0, Math.min(100, Math.round((accuracy * 0.6) + Math.min(total, 20) * 2)));
      animateNumber(document.getElementById('readinessScore'), readiness);
      var readinessBar = document.getElementById('readinessBar');
      if (readinessBar) setTimeout(function () { readinessBar.style.width = readiness + '%'; }, 150);

      // Total trend
      var weekSubs = countThisWeek(subs);
      setTrend('totalTrend', '+' + weekSubs + ' this week', weekSubs > 0 ? 'up' : '');

      // Streak & Rank
      updateStreak(streak);
      updateRank(points);

      // Hero section
      buildHero(streak, points, total);

      // Weekly Performance chart
      buildWeekly(subs);

      // Activity heatmap
      buildHeatmap(subs);

      // Weak Topics
      buildWeakTopics(data.weakTopics || []);

      // Recent Submissions
      buildSubmissionsTable(subs);
    })
    .catch(function (err) {
      console.error('Dashboard load failed:', err);
      var pc = document.querySelector('.page-content');
      if (pc) {
        var b = document.createElement('div');
        b.className = 'dash-error-banner';
        b.textContent = 'Could not load dashboard data. Please try again later.';
        pc.prepend(b);
      }
    });

  // ── Count this week ──
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

  // ── Weekly Performance chart ──
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

    // Find best day
    var bestIdx = 0;
    for (var j = 1; j < 7; j++) {
      if (counts[j] > counts[bestIdx]) bestIdx = j;
    }

    for (var i = 0; i < 7; i++) {
      var dt = new Date(now);
      dt.setDate(dt.getDate() - (6 - i));
      var label = dayNames[dt.getDay()];
      var h = Math.max((counts[i] / max) * maxH, 4);
      var isToday = i === 6;
      var isBest = counts[bestIdx] > 0 && i === bestIdx;

      var col = document.createElement('div');
      col.className = 'flex-1 flex flex-col items-center group';
      col.innerHTML =
        '<div class="relative flex items-end justify-center w-full" style="height:' + maxH + 'px">' +
          '<div class="dash-bar' + (isToday ? ' today' : '') + (isBest ? ' best' : '') + '" style="height:' + h + 'px"></div>' +
          '<div class="dash-bar-tooltip">' + counts[i] + ' solved</div>' +
        '</div>' +
        '<span class="dash-bar-label' + (isToday ? ' today' : '') + '">' + label + '</span>';
      container.appendChild(col);
    }

    // Week total
    var weekSum = counts.reduce(function (a, b) { return a + b; }, 0);
    setText('weekTotal', weekSum + ' submissions');

    // Summary line
    var summaryEl = document.getElementById('weekSummary');
    if (summaryEl) {
      if (weekSum === 0) {
        summaryEl.textContent = '0 problems solved this week';
      } else {
        var bestDt = new Date(now);
        bestDt.setDate(bestDt.getDate() - (6 - bestIdx));
        var bestDay = dayNames[bestDt.getDay()];
        summaryEl.textContent = 'Your best day: ' + bestDay + ' (' + counts[bestIdx] + ' solved)';
      }
    }
  }

  // ── Weak Topics ──
  function buildWeakTopics(weakTopics) {
    var weakList = document.getElementById('weakList');
    var weakCount = document.getElementById('weakTopicCount');
    var weakSummary = document.getElementById('weakSummary');
    if (!weakList) return;

    if (weakTopics && weakTopics.length) {
      weakList.innerHTML = '';
      if (weakCount) weakCount.textContent = weakTopics.length + ' topics flagged';
      if (weakSummary) weakSummary.textContent = 'Focus on these areas to improve';

      weakTopics.forEach(function (t) {
        var mastery = Math.max(0, Math.min(100, 100 - (t.wrongCount || 0) * 10));
        var isLow = mastery < 50;
        var row = document.createElement('div');
        row.className = 'dash-weak-topic';
        row.innerHTML =
          '<div class="flex items-center justify-between">' +
            '<div class="flex items-center gap-2">' +
              (isLow ? '<svg class="w-3.5 h-3.5 shrink-0" style="color:var(--danger)" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 15.75h.007v.008H12v-.008z" stroke-linecap="round" stroke-linejoin="round"/></svg>' : '') +
              '<span class="text-sm" style="color:var(--text-primary)">' + escHtml(t.topic) + '</span>' +
            '</div>' +
            '<span class="text-xs font-semibold" style="color:' + (isLow ? 'var(--danger)' : 'var(--text-muted)') + '">' + mastery + '%</span>' +
          '</div>' +
          '<div class="dash-weak-bar-track">' +
            '<div class="dash-weak-bar-fill" style="width:' + mastery + '%"></div>' +
          '</div>';
        weakList.appendChild(row);
      });
    } else {
      weakList.innerHTML = emptyHtml(
        '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" stroke-width="1.5" style="opacity:0.4"><path stroke-linecap="round" stroke-linejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18"/></svg>',
        'No weak topics identified',
        'Start solving problems to identify improvement areas.',
        'Browse Problems',
        '/pages/problems.html'
      );
      if (weakCount) weakCount.textContent = '0 topics flagged';
      if (weakSummary) weakSummary.textContent = '';
    }
  }

  // ── Activity Heatmap (7-day) ──
  function buildHeatmap(subs) {
    var container = document.getElementById('dashHeatmap');
    if (!container) return;

    var dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    var now = new Date();
    var dayOfWeek = now.getDay();
    var todayIdx = (dayOfWeek + 6) % 7;

    var counts = [0, 0, 0, 0, 0, 0, 0];
    (subs || []).forEach(function (s) {
      var dateField = s.submittedAt || s.createdAt || s.date;
      if (!dateField) return;
      var sd = new Date(dateField);
      var diff = Math.floor((now - sd) / (1000 * 60 * 60 * 24));
      if (diff < 7 && diff >= 0) {
        counts[6 - diff]++;
      }
    });

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

    // Summary
    var total = counts.reduce(function (a, b) { return a + b; }, 0);
    var summaryEl = document.getElementById('heatmapSummary');
    if (summaryEl) {
      if (total === 0) {
        summaryEl.textContent = 'No submissions in the last 7 days';
      } else {
        var activeDays = counts.filter(function (c) { return c > 0; }).length;
        summaryEl.textContent = total + ' submissions across ' + activeDays + ' active day' + (activeDays !== 1 ? 's' : '');
      }
    }
  }

  // ── Submissions Table ──
  function buildSubmissionsTable(subs) {
    var tbody = document.getElementById('submissionsBody');
    var subCountEl = document.getElementById('subCount');
    if (!tbody) return;

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
      tbody.innerHTML = '<tr><td colspan="5">' +
        emptyHtml(
          '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" stroke-width="1.5" style="opacity:0.4"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-6.548 0c-1.131.094-1.976 1.057-1.976 2.192V16.5A2.25 2.25 0 0012 18.75h.75m0 0h3.75m-3.75 0v2.625c0 .621.504 1.125 1.125 1.125H18a2.25 2.25 0 002.25-2.25V18M6 12.75h.008v.008H6v-.008zm0 3h.008v.008H6v-.008zm0 3h.008v.008H6v-.008z"/></svg>',
          'No submissions yet',
          'Your submissions will appear here once you solve your first problem.',
          'Browse Problems',
          '/pages/problems.html'
        ) + '</td></tr>';
    }
    if (subCountEl) subCountEl.textContent = subs.length;
  }

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function escHtml(s) { var d = document.createElement('div'); d.appendChild(document.createTextNode(s || '')); return d.innerHTML; }

  // ── Practice Sessions ──
  Api.getPractice()
    .then(function (practices) {
      var tbody = document.getElementById('practiceBody');
      var countEl = document.getElementById('practiceCount');
      if (!tbody) return;

      var avgTimeEl = document.getElementById('solveTimeAvg');
      var timeTrendEl = document.getElementById('timeTrend');
      if (avgTimeEl) {
        var totalMinutes = 0;
        var validCount = 0;
        (practices || []).forEach(function (p) {
          if (!p || !p.timeTaken) return;
          var parts = String(p.timeTaken).split(':');
          if (parts.length !== 2) return;
          var mm = parseInt(parts[0], 10);
          var ss = parseInt(parts[1], 10);
          if (isNaN(mm) || isNaN(ss)) return;
          totalMinutes += (mm + (ss / 60));
          validCount++;
        });
        var avgMinutes = validCount ? Math.max(0, Math.round(totalMinutes / validCount)) : 0;
        animateNumber(avgTimeEl, avgMinutes);
        if (timeTrendEl) {
          var span = timeTrendEl.querySelector('span');
          if (span) span.textContent = validCount ? ('From ' + validCount + ' sessions') : 'No sessions yet';
        }
      }

      if (practices && practices.length) {
        tbody.innerHTML = '';
        practices.forEach(function (p) {
          var dateStr = p.date ? new Date(p.date).toLocaleDateString() : '';
          var tr = document.createElement('tr');
          tr.innerHTML =
            '<td class="max-w-[260px] truncate">' + escHtml(p.question) + '</td>' +
            '<td><span class="diff-badge" style="background:rgba(59,130,246,0.12);color:var(--text-secondary)">' + escHtml(p.language) + '</span></td>' +
            '<td>' + escHtml(p.timeTaken) + '</td>' +
            '<td>' + (p.hintsUsed || 0) + (p.solutionViewed ? ' + solution' : '') + '</td>' +
            '<td>' + dateStr + '</td>';
          tbody.appendChild(tr);
        });
      } else {
        tbody.innerHTML = '<tr><td colspan="5">' +
          emptyHtml(
            '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" stroke-width="1.5" style="opacity:0.4"><path stroke-linecap="round" stroke-linejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"/></svg>',
            'No practice sessions yet',
            'Use the Preecode VS Code extension to practice coding problems. Your sessions will appear here automatically.',
            'Learn More',
            '/pages/problems.html'
          ) + '</td></tr>';
      }
      if (countEl) countEl.textContent = (practices ? practices.length : 0);
    })
    .catch(function (err) {
      console.error('Practice data load failed:', err);
    });
})();
