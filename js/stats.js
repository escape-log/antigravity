const Stats = {
    init() {
        this.cacheDOM();
        this.bindEvents();
    },

    cacheDOM() {
        this.dom = {
            // Scoped to #view-stats only
            filters: document.querySelectorAll('#view-stats .ranking-filters .btn-filter'),

            totalTime: document.getElementById('stat-total-time'),
            completionRate: document.getElementById('stat-completion-rate'),
            avgAchievement: document.getElementById('stat-avg-achievement'),
            sessionCount: document.getElementById('stat-session-count'),

            emptyState: document.getElementById('stats-empty-state'),
            dayList: document.getElementById('stats-day-list'),
            sessionList: document.getElementById('stats-session-list'),
            chartArea: document.getElementById('stats-chart-area'),
            chart: document.getElementById('stats-chart'),
            chartLabels: document.getElementById('stats-chart-labels'),

            // Excuse ranking + V2 eval breakdown container
            extraArea: document.getElementById('stats-extra-area')
        };
    },

    bindEvents() {
        this.dom.filters.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.dom.filters.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.render(e.target.dataset.period);
            });
        });
    },

    open() {
        this.dom.filters.forEach(b => b.classList.remove('active'));
        if (this.dom.filters.length > 0) this.dom.filters[0].classList.add('active');
        this.render('day');
    },

    render(period) {
        const sessions = Store.getSessions();
        const now = new Date();

        let filtered = [];

        if (period === 'day') {
            const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            filtered = sessions.filter(s => new Date(s.date_start) >= dayStart);
        } else if (period === 'week') {
            const dayOfWeek = now.getDay() || 7;
            const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + 1);
            filtered = sessions.filter(s => new Date(s.date_start) >= weekStart);
        } else if (period === 'month') {
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            filtered = sessions.filter(s => new Date(s.date_start) >= monthStart);
        }

        this.updateMetrics(filtered);

        // Always show metrics; show empty state message in dynamic area if no sessions
        if (filtered.length === 0) {
            this.dom.emptyState.classList.remove('hidden');
            this.dom.dayList.classList.add('hidden');
            this.dom.chartArea.classList.add('hidden');
        } else {
            this.dom.emptyState.classList.add('hidden');
            if (period === 'day') {
                this.dom.dayList.classList.remove('hidden');
                this.dom.chartArea.classList.add('hidden');
                this.renderDayList(filtered);
            } else if (period === 'week') {
                this.dom.dayList.classList.add('hidden');
                this.dom.chartArea.classList.remove('hidden');
                this.renderWeekChart(filtered);
            } else if (period === 'month') {
                this.dom.dayList.classList.add('hidden');
                this.dom.chartArea.classList.remove('hidden');
                this.renderMonthChart(filtered);
            }
        }

        // Always render extra area (ranking + eval breakdown)
        this.renderExtraArea(period);
    },

    updateMetrics(sessions) {
        let totalMin = 0;
        let completeCount = 0;
        let sumAchievement = 0;

        sessions.forEach(s => {
            totalMin += (s.actual_minutes || 0);
            if (s.result === 'complete') completeCount++;
            sumAchievement += (s.achievement_rate || 0);
        });

        const totalSess = sessions.length;
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;

        this.dom.totalTime.textContent = h > 0 ? `${h}h ${m}m` : `${m}m`;
        this.dom.sessionCount.textContent = totalSess;
        this.dom.completionRate.textContent = totalSess > 0 ? `${Math.round((completeCount / totalSess) * 100)}%` : '0%';
        this.dom.avgAchievement.textContent = totalSess > 0 ? `${Math.round(sumAchievement / totalSess)}%` : '0%';
    },

    renderDayList(sessions) {
        const sorted = [...sessions].sort((a, b) => new Date(b.date_start) - new Date(a.date_start));
        let html = '';
        sorted.forEach(s => {
            const d = new Date(s.date_start);
            const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
            const goal = s.goal_text || '目標なし';
            const resColor = s.result === 'complete' ? 'var(--accent-green)' : 'var(--accent-red)';
            const resLabel = s.result === 'complete' ? '完走' : '放棄';

            html += `
                <li class="glass-panel" style="padding:12px; font-size:14px; display:flex; flex-direction:column; gap:6px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="color:var(--text-secondary)">${timeStr}</span>
                        <span style="color:${resColor}; font-weight:bold;">${resLabel}</span>
                    </div>
                    <div style="font-weight:600;">${goal}</div>
                    <div style="display:flex; justify-content:space-between; font-size:12px;">
                        <span style="color:var(--text-secondary)">実働 ${s.actual_minutes || 0}分</span>
                        <span style="color:var(--accent-purple)">達成率 ${s.achievement_rate || 0}%</span>
                    </div>
                </li>
            `;
        });
        this.dom.sessionList.innerHTML = html;
    },

    renderWeekChart(sessions) {
        const buckets = [0, 0, 0, 0, 0, 0, 0];
        const labels = ['月', '火', '水', '木', '金', '土', '日'];
        sessions.forEach(s => {
            const d = new Date(s.date_start);
            const dayOfW = d.getDay() || 7;
            buckets[dayOfW - 1] += (s.actual_minutes || 0);
        });
        this.drawBars(buckets, labels);
    },

    renderMonthChart(sessions) {
        const buckets = [0, 0, 0, 0];
        const labels = ['第1週', '第2週', '第3週', '第4週'];
        sessions.forEach(s => {
            const d = new Date(s.date_start);
            let wIdx = Math.floor((d.getDate() - 1) / 7);
            if (wIdx > 3) wIdx = 3;
            buckets[wIdx] += (s.actual_minutes || 0);
        });
        this.drawBars(buckets, labels);
    },

    drawBars(buckets, labels) {
        const maxVal = Math.max(...buckets, 1);
        let htmlBars = '';
        buckets.forEach(val => {
            const height = Math.max(Math.round((val / maxVal) * 100), 2);
            htmlBars += `
                <div style="display:flex; flex-direction:column; align-items:center; flex:1; margin:0 2px;">
                    <div style="font-size:10px; margin-bottom:4px; color:var(--text-secondary)">${val > 0 ? val + 'm' : '0'}</div>
                    <div style="width:100%; background:linear-gradient(to top, var(--accent-blue), var(--accent-purple)); border-radius:4px 4px 0 0; min-height:2px; height:${height}%; transition:height 0.3s;"></div>
                </div>
            `;
        });
        this.dom.chart.innerHTML = htmlBars;

        let htmlLabels = '';
        labels.forEach(l => {
            htmlLabels += `<div style="flex:1; text-align:center; font-size:11px;">${l}</div>`;
        });
        this.dom.chartLabels.innerHTML = htmlLabels;
    },

    renderExtraArea(period) {
        const el = this.dom.extraArea;
        if (!el) return;

        let html = '';

        // ---- 1. Excuse Ranking ----
        html += '<h4 style="margin:0 0 10px 0; color:var(--text-secondary); font-size:13px;">逃げランキング</h4>';
        const now = new Date();
        let sessions = Store.getSessions().filter(s => s.result === 'abandoned');
        if (period === 'week') {
            const dayOfWeek = now.getDay() || 7;
            const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + 1);
            sessions = sessions.filter(s => new Date(s.date_start) >= weekStart);
        } else if (period === 'month') {
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            sessions = sessions.filter(s => new Date(s.date_start) >= monthStart);
        } else if (period === 'day') {
            const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            sessions = sessions.filter(s => new Date(s.date_start) >= dayStart);
        }

        const counts = {};
        const types = {};
        sessions.forEach(s => {
            if (s.excuse_text) {
                counts[s.excuse_text] = (counts[s.excuse_text] || 0) + 1;
                types[s.excuse_text] = s.excuse_type;
            }
        });
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

        if (sorted.length === 0) {
            html += '<div style="color:#666; font-size:13px; padding:8px 0;">放棄記録なし</div>';
        } else {
            sorted.slice(0, 5).forEach((item, idx) => {
                const [text, count] = item;
                const typeLabel = types[text] === 'self' ? '自責' : '不可抗力';
                const typeColor = types[text] === 'self' ? 'var(--accent-red)' : 'var(--text-secondary)';
                html += `<div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.05); font-size:13px;">
                    <span>${idx + 1}. ${text} <small style="color:var(--text-secondary)">(${count}回)</small></span>
                    <span style="color:${typeColor}; font-size:11px;">${typeLabel}</span>
                </div>`;
            });
        }

        // ---- 2. V2 Evaluation Breakdown ----
        html += '<h4 style="margin:16px 0 10px 0; color:var(--text-secondary); font-size:13px;">V2 評価内訳（今日）</h4>';
        const slotsData = Store.getSlotsForDate(Store.getTodayStr());
        const evalCounters = { '○': 0, '△': 0, '▲': 0, '□': 0, '×': 0 };
        let evalTotal = 0;
        Object.values(slotsData).forEach(s => {
            if (s.evaluation && evalCounters.hasOwnProperty(s.evaluation)) {
                evalTotal++;
                evalCounters[s.evaluation]++;
            }
        });

        const colors = { '○': 'var(--accent-green)', '△': 'var(--accent-blue)', '▲': 'var(--accent-orange)', '□': 'var(--text-secondary)', '×': 'var(--accent-red)' };

        if (evalTotal === 0) {
            html += '<div style="color:#666; font-size:13px; padding:8px 0;">V2記録なし</div>';
        } else {
            // Mini bar
            html += '<div style="display:flex; height:14px; border-radius:7px; overflow:hidden; margin-bottom:8px;">';
            for (const [k, v] of Object.entries(evalCounters)) {
                if (v > 0) {
                    const pct = (v / evalTotal * 100).toFixed(1);
                    html += `<div style="width:${pct}%; background:${colors[k]}" title="${k} ${pct}%"></div>`;
                }
            }
            html += '</div>';
            // Legend
            html += '<div style="display:flex; flex-wrap:wrap; gap:10px; font-size:12px;">';
            for (const [k, v] of Object.entries(evalCounters)) {
                const pct = evalTotal > 0 ? Math.round(v / evalTotal * 100) : 0;
                html += `<span style="color:${colors[k]}">${k} ${v}件 (${pct}%)</span>`;
            }
            html += '</div>';
        }

        el.innerHTML = html;
    }
};
