const V2 = {
    date: null,
    slots: [],
    activeSlotKey: null,
    selectedEval: '',

    init() {
        this.date = Store.getTodayStr();
        this.initSlotsArray();
        this.cacheDOM();
        this.bindEvents();
    },

    initSlotsArray() {
        this.slots = [];
        for (let h = 0; h < 24; h++) {
            for (let m = 0; m < 60; m += 15) {
                this.slots.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
            }
        }
    },

    cacheDOM() {
        this.dom = {
            grid: document.getElementById('v2-log-grid'),
            editModal: document.getElementById('slot-edit-modal'),
            editTime: document.getElementById('slot-edit-time'),
            editPlan: document.getElementById('slot-edit-plan'),
            editActual: document.getElementById('slot-edit-actual'),
            editMemo: document.getElementById('slot-edit-memo'),
            btnSlotSave: document.getElementById('btn-slot-save'),
            btnSlotClose: document.getElementById('btn-slot-close'),
            warningBanner: document.getElementById('v2-warning-banner'),
            summaryText: document.getElementById('v2-waste-text')
        };
    },

    bindEvents() {
        this.dom.btnSlotSave.addEventListener('click', () => this.saveSlot());
        this.dom.btnSlotClose.addEventListener('click', () => this.closeModal());

        // Eval buttons inside the modal - use event delegation on the modal
        const evalContainer = this.dom.editModal.querySelector('.evaluation-options');
        if (evalContainer) {
            evalContainer.addEventListener('click', (e) => {
                const btn = e.target.closest('.btn-eval');
                if (!btn) return;
                // Highlight selected
                evalContainer.querySelectorAll('.btn-eval').forEach(b => {
                    b.classList.remove('eval-selected');
                    b.style.borderColor = 'var(--glass-border)';
                });
                btn.classList.add('eval-selected');
                btn.style.borderColor = 'white';
                this.selectedEval = btn.dataset.val;
            });
        }
    },

    render() {
        this.date = Store.getTodayStr();
        const slotsData = Store.getSlotsForDate(this.date);
        let gridHTML = '';

        this.slots.forEach((time, idx) => {
            const data = slotsData[time] || {};
            const ev = data.evaluation || '';
            const plan = data.plan || '';
            const actual = data.actual || '';
            const memo = data.memo || '';

            let cClass = '';
            switch(ev) {
                case '○': cClass = 'c-o'; break;
                case '△': cClass = 'c-t'; break;
                case '▲': cClass = 'c-p'; break;
                case '□': cClass = 'c-s'; break;
                case '×': cClass = 'c-x'; break;
                default: cClass = '';
            }

            // Build display text from plan/actual/memo
            let displayText = '';
            if (plan) displayText += `【予】${plan}`;
            if (actual) displayText += `${plan ? ' ' : ''}【実】${actual}`;
            if (memo && !plan && !actual) displayText = memo;
            else if (memo && (plan || actual)) displayText += ` ${memo}`;

            gridHTML += `
                <div class="log-slot ${cClass}" data-time="${time}" data-index="${idx}">
                    <div class="slot-time">${time}</div>
                    <div class="slot-eval">${ev}</div>
                    <div class="slot-content">${displayText ? displayText : '<span style="color:#555">─</span>'}</div>
                    <button class="btn-copy-prev" data-idx="${idx}" title="↑コピー">↑</button>
                </div>
            `;
        });

        this.dom.grid.innerHTML = gridHTML;

        // Bind slot clicks via delegation
        this.dom.grid.onclick = (e) => {
            const copyBtn = e.target.closest('.btn-copy-prev');
            if (copyBtn) {
                e.stopPropagation();
                this.copyPreviousSlot(parseInt(copyBtn.dataset.idx));
                return;
            }
            const slot = e.target.closest('.log-slot');
            if (slot) {
                this.openModal(slot.dataset.time);
            }
        };

        this.calculateSummary(slotsData);

        // Scroll to current time
        const currentSlot = Store.timeToSlotStr(new Date());
        setTimeout(() => {
            const el = this.dom.grid.querySelector(`.log-slot[data-time="${currentSlot}"]`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 200);
    },

    openModal(time) {
        this.activeSlotKey = time;
        const data = Store.getSlot(this.date, time);
        this.dom.editTime.textContent = time;
        this.dom.editPlan.value = data.plan || '';
        this.dom.editActual.value = data.actual || '';
        this.dom.editMemo.value = data.memo || '';
        this.selectedEval = data.evaluation || '';

        // Highlight correct eval button
        const evalBtns = this.dom.editModal.querySelectorAll('.btn-eval');
        evalBtns.forEach(b => {
            b.classList.remove('eval-selected');
            b.style.borderColor = (b.dataset.val === this.selectedEval) ? 'white' : 'var(--glass-border)';
            if (b.dataset.val === this.selectedEval) b.classList.add('eval-selected');
        });

        this.dom.editModal.classList.remove('hidden');
    },

    closeModal() {
        this.activeSlotKey = null;
        this.dom.editModal.classList.add('hidden');
    },

    saveSlot() {
        if (!this.activeSlotKey) return;
        Store.updateSlot(this.date, this.activeSlotKey, {
            evaluation: this.selectedEval,
            plan: this.dom.editPlan.value.trim(),
            actual: this.dom.editActual.value.trim(),
            memo: this.dom.editMemo.value.trim(),
            source: 'manual'
        });
        this.closeModal();
        this.render();
    },

    copyPreviousSlot(idx) {
        if (idx === 0) return;
        const prevKey = this.slots[idx - 1];
        const prevData = Store.getSlot(this.date, prevKey);
        if (prevData.evaluation) {
            Store.updateSlot(this.date, this.slots[idx], {
                evaluation: prevData.evaluation,
                plan: prevData.plan || '',
                actual: prevData.actual || '',
                memo: prevData.memo,
                source: 'manual'
            });
            this.render();
        }
    },

    calculateSummary(slotsData) {
        let total = 0;
        let counters = { '○':0, '△':0, '▲':0, '□':0, '×':0 };

        Object.values(slotsData).forEach(s => {
            if (s.evaluation && counters.hasOwnProperty(s.evaluation)) {
                total++;
                counters[s.evaluation]++;
            }
        });

        if (total === 0) {
            this.dom.summaryText.innerHTML = '<span style="color:var(--text-secondary)">まだ評価が入力されていません</span>';
            this.dom.warningBanner.classList.add('hidden');
            return;
        }

        // Build mini summary bar
        const colors = { '○':'var(--accent-green)', '△':'var(--accent-blue)', '▲':'var(--accent-orange)', '□':'var(--text-secondary)', '×':'var(--accent-red)' };
        let barHTML = '<div style="display:flex; height:12px; border-radius:6px; overflow:hidden; margin-bottom:8px;">';
        for (const [k, v] of Object.entries(counters)) {
            if (v > 0) {
                const pct = (v / total * 100).toFixed(1);
                barHTML += `<div style="width:${pct}%; background:${colors[k]}" title="${k} ${pct}%"></div>`;
            }
        }
        barHTML += '</div>';

        const xHours = (counters['×'] * 15 / 60).toFixed(1);
        const xPercent = Math.round(counters['×'] / total * 100);

        let legendHTML = '<div style="display:flex; flex-wrap:wrap; gap:8px; font-size:12px;">';
        for (const [k, v] of Object.entries(counters)) {
            legendHTML += `<span style="color:${colors[k]}">${k} ${v}件</span>`;
        }
        legendHTML += '</div>';

        this.dom.summaryText.innerHTML = barHTML + legendHTML +
            `<div style="margin-top:8px; font-size:14px;">敗北時間（×）: <strong style="color:var(--accent-red)">${xHours}h (${xPercent}%)</strong></div>`;

        // Check force majeure warning
        const sPercent = (counters['□'] / total) * 100;
        const threshold = Store.getSettings().forceMajeureThreshold || 30;
        if (sPercent > threshold) {
            this.dom.warningBanner.classList.remove('hidden');
        } else {
            this.dom.warningBanner.classList.add('hidden');
        }
    }
};
