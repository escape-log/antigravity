const Settings = {
    editMode: null,

    init() {
        this.cacheDOM();
        this.bindEvents();
    },

    cacheDOM() {
        this.dom = {
            btnEditSlots: document.getElementById('btn-edit-slots'),
            btnEditExcuses: document.getElementById('btn-edit-excuses'),
            btnSaveSettings: document.getElementById('btn-save-settings'),
            thresholdInput: document.getElementById('threshold-input'),
            remind1: document.getElementById('remind-1'),
            remind2: document.getElementById('remind-2'),
            remind3: document.getElementById('remind-3'),
            // Scoped to settings view only
            rankingList: document.getElementById('excuse-ranking-list'),
            rankingFilters: document.querySelectorAll('#view-settings .ranking-filters .btn-filter'),

            arrayModal: document.getElementById('array-edit-modal'),
            arrayTitle: document.getElementById('array-edit-title'),
            arrayList: document.getElementById('array-edit-list'),
            btnAddItem: document.getElementById('btn-array-add'),
            btnCloseArray: document.getElementById('btn-array-close'),

            statsContainer: document.getElementById('stats-container'),
            btnExportData: document.getElementById('btn-export-data'),
            btnImportData: document.getElementById('btn-import-data')
        };
    },

    bindEvents() {
        this.dom.btnEditSlots.addEventListener('click', () => this.openArrayEdit('slots'));
        this.dom.btnEditExcuses.addEventListener('click', () => this.openArrayEdit('excuses'));
        this.dom.btnSaveSettings.addEventListener('click', () => this.saveGlobalSettings());
        this.dom.btnExportData.addEventListener('click', () => this.exportData());
        this.dom.btnImportData.addEventListener('click', () => this.importData());

        // "完了" button - delegate to current mode handler
        this.dom.btnCloseArray.addEventListener('click', () => this.handleArrayClose());

        // "追加" button
        this.dom.btnAddItem.addEventListener('click', () => this.addArrayItem());

        // Only settings-scoped ranking filters
        this.dom.rankingFilters.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.dom.rankingFilters.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.renderRanking(e.target.dataset.period);
            });
        });
    },

    handleArrayClose() {
        if (this.editMode === 'slots') {
            this.saveSlotsEdit();
        } else if (this.editMode === 'excuses') {
            this.saveExcusesEdit();
        } else {
            this.closeArrayEdit();
        }
    },

    render() {
        const set = Store.getSettings();
        this.dom.thresholdInput.value = set.forceMajeureThreshold || 30;

        if (set.reminders && set.reminders.length >= 3) {
            this.dom.remind1.value = set.reminders[0];
            this.dom.remind2.value = set.reminders[1];
            this.dom.remind3.value = set.reminders[2];
        }

        this.renderRanking('all');
        this.renderStats();
    },

    renderRanking(period) {
        const now = new Date();
        let sessions = Store.getSessions().filter(s => s.result === 'abandoned');

        // Period filtering
        if (period === 'week') {
            const dayOfWeek = now.getDay() || 7;
            const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + 1);
            sessions = sessions.filter(s => new Date(s.date_start) >= weekStart);
        } else if (period === 'month') {
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            sessions = sessions.filter(s => new Date(s.date_start) >= monthStart);
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
            this.dom.rankingList.innerHTML = '<li style="color:#888; text-align:center; padding: 20px;">まだデータがありません</li>';
            return;
        }

        let html = '';
        sorted.slice(0, 10).forEach((item, idx) => {
            const [text, count] = item;
            const typeClass = types[text] === 'self' ? 'attr-self' : 'attr-force';
            const typeLabel = types[text] === 'self' ? '自責' : '不可抗力';
            html += `
                <li style="display:flex; justify-content:space-between; padding: 12px; border-bottom: 1px solid var(--glass-border);">
                    <div>
                        <strong style="margin-right:10px">${idx + 1}位</strong>
                        <span>${text}</span>
                        <small style="color:var(--text-secondary); margin-left: 10px;">(${count}回)</small>
                    </div>
                    <span class="attr ${typeClass}" style="font-size:10px; padding:2px 6px; border-radius:4px;">${typeLabel}</span>
                </li>
            `;
        });
        this.dom.rankingList.innerHTML = html;
    },

    renderStats() {
        const sessions = Store.getSessions();
        const total = sessions.length;
        const completed = sessions.filter(s => s.result === 'complete').length;

        let totalMinutes = 0;
        let sumAchievement = 0;
        sessions.forEach(s => {
            totalMinutes += (s.actual_minutes || 0);
            sumAchievement += (s.achievement_rate || 0);
        });

        const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
        const avgAchieve = total > 0 ? Math.round(sumAchievement / total) : 0;

        this.dom.statsContainer.innerHTML = `
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <div class="glass-panel" style="padding:16px; text-align:center;">
                    <h4 style="color:var(--text-secondary); margin-bottom: 8px; font-size:12px;">総集中時間</h4>
                    <div style="font-size:24px; font-weight:bold; color:var(--accent-blue)">
                        ${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m
                    </div>
                </div>
                <div class="glass-panel" style="padding:16px; text-align:center;">
                    <h4 style="color:var(--text-secondary); margin-bottom: 8px; font-size:12px;">完走率</h4>
                    <div style="font-size:24px; font-weight:bold; color:var(--accent-green)">
                        ${rate}%
                    </div>
                </div>
                <div class="glass-panel" style="padding:16px; text-align:center;">
                    <h4 style="color:var(--text-secondary); margin-bottom: 8px; font-size:12px;">平均達成率</h4>
                    <div style="font-size:24px; font-weight:bold; color:var(--accent-purple)">
                        ${avgAchieve}%
                    </div>
                </div>
                <div class="glass-panel" style="padding:16px; text-align:center;">
                    <h4 style="color:var(--text-secondary); margin-bottom: 8px; font-size:12px;">セッション数</h4>
                    <div style="font-size:24px; font-weight:bold; color:white">
                        ${total}
                    </div>
                </div>
            </div>
        `;
    },

    saveGlobalSettings() {
        const threshold = parseInt(this.dom.thresholdInput.value);
        const reminders = [
            this.dom.remind1.value,
            this.dom.remind2.value,
            this.dom.remind3.value
        ];
        if (!isNaN(threshold)) {
            Store.updateSettings({ forceMajeureThreshold: threshold, reminders: reminders });
            alert('設定を保存しました');
        }
    },

    exportData() {
        const data = {
            sessions: Store.getSessions(),
            settings: Store.getSettings()
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `antigravity-data-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    if (data.sessions && data.settings) {
                        if (confirm('データをインポートしますか？現在のデータは上書きされます。')) {
                            localStorage.setItem('antigravity_sessions', JSON.stringify(data.sessions));
                            localStorage.setItem('antigravity_settings', JSON.stringify(data.settings));
                            alert('データをインポートしました。アプリを再起動します。');
                            window.location.reload();
                        }
                    } else {
                        alert('無効なデータ形式です。');
                    }
                } catch (err) {
                    alert('ファイルの読み込みに失敗しました。');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    },

    // ---- Array Editor (Slots / Excuses) ----
    openArrayEdit(mode) {
        this.editMode = mode;
        this.dom.arrayModal.classList.remove('hidden');

        if (mode === 'slots') {
            this.dom.arrayTitle.textContent = 'タイマースロット編集';
            this.renderSlotsEdit();
        } else {
            this.dom.arrayTitle.textContent = '言い訳リスト編集';
            this.renderExcusesEdit();
        }
    },

    closeArrayEdit() {
        this.dom.arrayModal.classList.add('hidden');
        this.editMode = null;
    },

    renderSlotsEdit() {
        const settings = Store.getSettings();
        let html = '';
        settings.timerSlots.forEach((min) => {
            html += `
                <div class="input-group" style="flex-direction:row; align-items:center; margin-bottom: 10px;">
                    <input type="number" class="temp-slot glass-input" value="${min}" min="1" max="180" style="flex:1" ${min === 25 ? 'disabled' : ''}>
                    ${min !== 25 ? '<button class="btn-danger ripple" style="margin-left:8px" onclick="this.parentElement.remove()">削除</button>' : '<span style="width:70px;text-align:center;color:var(--text-secondary)">固定</span>'}
                </div>
            `;
        });
        this.dom.arrayList.innerHTML = html;
        this.dom.btnAddItem.style.display = settings.timerSlots.length >= 5 ? 'none' : 'block';
    },

    saveSlotsEdit() {
        const inputs = this.dom.arrayList.querySelectorAll('.temp-slot');
        let newSlots = [];
        inputs.forEach(inp => {
            const val = parseInt(inp.value);
            if (!isNaN(val) && val > 0) newSlots.push(val);
        });
        if (!newSlots.includes(25)) newSlots.unshift(25);
        Store.updateSettings({ timerSlots: newSlots.slice(0, 5) });
        this.closeArrayEdit();
        V1.renderSetup();
        alert('タイマースロットを保存しました');
    },

    renderExcusesEdit() {
        const settings = Store.getSettings();
        let html = '';
        settings.excuses.forEach(ex => { html += this.createExcuseRowHTML(ex); });
        this.dom.arrayList.innerHTML = html;
        this.dom.btnAddItem.style.display = 'block';
    },

    createExcuseRowHTML(ex) {
        const safeText = (ex.text || '').replace(/"/g, '&quot;');
        return `
            <div class="temp-excuse glass-panel" data-id="${ex.id || ''}" style="padding:10px; margin-bottom:10px; display:flex; flex-direction:column; gap:8px; border: 1px solid var(--glass-border);">
                <input type="text" class="ex-text glass-input" value="${safeText}" placeholder="言い訳を入力" style="padding:8px; font-size:14px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <select class="ex-type glass-input" style="width: auto; padding:8px; background:rgba(0,0,0,0.5);">
                        <option value="self" ${ex.type === 'self' ? 'selected' : ''}>自責</option>
                        <option value="force_majeure" ${ex.type === 'force_majeure' ? 'selected' : ''}>不可抗力</option>
                    </select>
                    <button class="btn-danger ripple" onclick="this.parentElement.parentElement.remove()" style="padding:8px 16px;">削除</button>
                </div>
            </div>
        `;
    },

    saveExcusesEdit() {
        const rows = this.dom.arrayList.querySelectorAll('.temp-excuse');
        let newExcuses = [];
        rows.forEach((row, idx) => {
            const text = row.querySelector('.ex-text').value.trim();
            const type = row.querySelector('.ex-type').value;
            if (text) {
                const existingId = parseInt(row.dataset.id);
                newExcuses.push({
                    id: !isNaN(existingId) && existingId > 0 ? existingId : Date.now() + idx,
                    text: text,
                    type: type
                });
            }
        });
        Store.updateSettings({ excuses: newExcuses });
        this.renderRanking('all');
        this.closeArrayEdit();
        alert('言い訳リストを保存しました');
    },

    addArrayItem() {
        if (this.editMode === 'slots') {
            const items = this.dom.arrayList.querySelectorAll('.input-group');
            if (items.length >= 5) { alert('カスタムスロットは最大5つまでです。'); return; }
            const div = document.createElement('div');
            div.innerHTML = `
                <div class="input-group" style="flex-direction:row; align-items:center; margin-bottom: 10px;">
                    <input type="number" class="temp-slot glass-input" value="15" min="1" max="180" style="flex:1" placeholder="分数を入力">
                    <button class="btn-danger ripple" style="margin-left:8px" onclick="this.parentElement.remove()">削除</button>
                </div>
            `;
            this.dom.arrayList.appendChild(div.firstElementChild);
        } else {
            const div = document.createElement('div');
            div.innerHTML = this.createExcuseRowHTML({ id: '', text: '', type: 'self' });
            this.dom.arrayList.appendChild(div.firstElementChild);
        }
    }
};
