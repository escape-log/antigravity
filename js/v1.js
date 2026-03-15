const V1 = {
    state: {
        timerId: null,
        timeLeft: 0,
        originalTime: 0,
        plannedMinutes: 25,
        targetAmount: 0, // e.g. 20 (from text, parsed if possible, or NaN)
        startTime: null,
        pauseTime: null,
        stage: 'setup', // setup, active, paused, abandon-step1, abandon-step2, eval
        status: 'stopped', // stopped, running, paused
        
        abandonExcuseParams: {}
    },
    
    init() {
        this.cacheDOM();
        this.bindEvents();
        this.renderSetup();
    },
    
    cacheDOM() {
        this.dom = {
            setupStage: document.getElementById('v1-setup'),
            activeStage: document.getElementById('v1-active'),
            pausedOver: document.getElementById('v1-paused'),
            abandonS1: document.getElementById('v1-abandon-step1'),
            abandonS2: document.getElementById('v1-abandon-step2'),
            evalScreen: document.getElementById('v1-evaluation'),
            
            lastFailureBanner: document.getElementById('last-failure-banner'),
            lastFailureText: document.getElementById('last-failure-text'),
            goalInput: document.getElementById('goal-input'),
            slotsContainer: document.getElementById('timer-slots-container'),
            
            btnStart: document.getElementById('btn-start-timer'),
            btnPause: document.getElementById('btn-pause-timer'),
            btnResume: document.getElementById('btn-resume-timer'),
            btnAbandon: document.getElementById('btn-abandon-timer'),
            
            timeDisplay: document.getElementById('time-display'),
            activeGoalText: document.getElementById('active-goal-text'),
            ringCircle: document.querySelector('.progress-ring-circle'),
            pauseCountdown: document.getElementById('pause-countdown-display'),
            
            excuseList: document.getElementById('excuse-list-container'),
            btnCancelAbandon: document.getElementById('btn-cancel-abandon'),
            
            lossFeedback: document.getElementById('loss-feedback-text'),
            btnLossAck: document.getElementById('btn-loss-acknowledge'),
            
            btnRatings: document.querySelectorAll('.btn-rating')
        };
        
        // Ring circumference calc
        if(this.dom.ringCircle) {
            const radius = this.dom.ringCircle.r.baseVal.value;
            this.circumference = radius * 2 * Math.PI;
            this.dom.ringCircle.style.strokeDasharray = `${this.circumference} ${this.circumference}`;
            this.dom.ringCircle.style.strokeDashoffset = this.circumference;
        }
    },
    
    bindEvents() {
        this.dom.btnStart.addEventListener('click', () => this.startTimer());
        this.dom.btnPause.addEventListener('click', () => this.pauseTimer());
        this.dom.btnResume.addEventListener('click', () => this.resumeTimer());
        this.dom.btnAbandon.addEventListener('click', () => this.showAbandonS1());
        this.dom.btnCancelAbandon.addEventListener('click', () => this.resumeTimer(true)); // back to pause actually
        this.dom.btnLossAck.addEventListener('click', () => this.finishAbandon());
        
        this.dom.btnRatings.forEach(btn => {
            btn.addEventListener('click', (e) => this.submitEvaluation(parseInt(e.target.dataset.rate)));
        });
    },

    renderSetup() {
        // Render failure logic
        const lastFail = Store.getLastAbandonedSession();
        if(lastFail && lastFail.excuse_text) {
            this.dom.lastFailureBanner.classList.remove('hidden');
            this.dom.lastFailureText.textContent = `前回の敗因：「${lastFail.excuse_text}」（${lastFail.actual_minutes}分で放棄）`;
        } else {
            this.dom.lastFailureBanner.classList.add('hidden');
        }

        // Render timer slots
        const settings = Store.getSettings();
        let slotsHTML = '<button class="slot-btn active" data-min="25">25分</button>';
        const customSlots = settings.timerSlots.filter(s => s !== 25).slice(0, 4);
        customSlots.forEach(min => {
            slotsHTML += `<button class="slot-btn" data-min="${min}">${min}分</button>`;
        });
        this.dom.slotsContainer.innerHTML = slotsHTML;
        
        // slot event delegation
        this.dom.slotsContainer.querySelectorAll('.slot-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.dom.slotsContainer.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.state.plannedMinutes = parseInt(e.target.dataset.min);
            });
        });

        this.switchStage('setup');
    },

    switchStage(stage) {
        this.state.stage = stage;
        this.dom.setupStage.classList.add('hidden');
        this.dom.activeStage.classList.add('hidden');
        this.dom.pausedOver.classList.add('hidden');
        this.dom.abandonS1.classList.add('hidden');
        this.dom.abandonS2.classList.add('hidden');
        this.dom.evalScreen.classList.add('hidden');

        switch(stage) {
            case 'setup': this.dom.setupStage.classList.remove('hidden'); break;
            case 'active': this.dom.activeStage.classList.remove('hidden'); break;
            case 'paused': this.dom.activeStage.classList.remove('hidden'); this.dom.pausedOver.classList.remove('hidden'); break;
            case 'abandon-step1': this.dom.abandonS1.classList.remove('hidden'); break;
            case 'abandon-step2': this.dom.abandonS2.classList.remove('hidden'); break;
            case 'eval': this.dom.evalScreen.classList.remove('hidden'); break;
        }
    },

    startTimer() {
        const goal = this.dom.goalInput.value.trim();
        this.dom.activeGoalText.textContent = goal || '目標未設定';
        
        // try extracting target amount
        const match = goal.match(/\d+/);
        this.state.targetAmount = match ? parseInt(match[0]) : 0;
        
        // Get planned min if not already selected due to UI bug (failsafe)
        const activeSlot = this.dom.slotsContainer.querySelector('.active');
        if(activeSlot) this.state.plannedMinutes = parseInt(activeSlot.dataset.min);

        this.state.originalTime = this.state.plannedMinutes * 60;
        this.state.timeLeft = this.state.originalTime;
        this.state.startTime = new Date();
        this.state.status = 'running';
        
        this.updateTimeDisplay(this.state.timeLeft, this.dom.timeDisplay);
        this.updateRing(this.state.timeLeft, this.state.originalTime);
        this.switchStage('active');

        this.state.timerId = setInterval(() => this.tick(), 1000);
    },

    tick() {
        if(this.state.status !== 'running') return;
        this.state.timeLeft--;
        
        this.updateTimeDisplay(this.state.timeLeft, this.dom.timeDisplay);
        this.updateRing(this.state.timeLeft, this.state.originalTime);

        if(this.state.timeLeft <= 0) {
            this.completeSession();
        }
    },

    pauseTimer() {
        this.state.status = 'paused';
        this.state.pauseTimeLeft = 5 * 60; // 5 min
        this.updateTimeDisplay(this.state.pauseTimeLeft, this.dom.pauseCountdown);
        this.switchStage('paused');
        
        // Handle 5min countdown tick implicitly?
        this.state.pauseInterval = setInterval(() => {
            this.state.pauseTimeLeft--;
            this.updateTimeDisplay(this.state.pauseTimeLeft, this.dom.pauseCountdown);
            if(this.state.pauseTimeLeft <= 0) {
                clearInterval(this.state.pauseInterval);
                this.showAbandonS1(); // forced abandon
            }
        }, 1000);
    },

    resumeTimer(fromAbandon = false) {
        if(!fromAbandon) {
            clearInterval(this.state.pauseInterval);
        }
        this.state.status = 'running';
        this.switchStage('active');
    },

    showAbandonS1() {
        clearInterval(this.state.pauseInterval);
        const settings = Store.getSettings();
        let excusesHTML = '';
        settings.excuses.forEach(ex => {
            const attrClass = ex.type === 'self' ? 'attr-self' : 'attr-force';
            const attrLabel = ex.type === 'self' ? '自責' : '不可抗力';
            excusesHTML += `
                <div class="excuse-item ripple" data-id="${ex.id}">
                    <span>${ex.text}</span>
                    <span class="attr ${attrClass}">${attrLabel}</span>
                </div>
            `;
        });
        
        this.dom.excuseList.innerHTML = excusesHTML;
        this.dom.excuseList.querySelectorAll('.excuse-item').forEach(el => {
            el.addEventListener('click', (e) => {
                const id = parseInt(e.currentTarget.dataset.id);
                const excuse = settings.excuses.find(x => x.id === id);
                this.handleAbandonExcuseSelection(excuse);
            });
        });
        
        this.switchStage('abandon-step1');
    },

    handleAbandonExcuseSelection(excuse) {
        this.state.abandonExcuseParams = {
            id: excuse.id,
            text: excuse.text,
            type: excuse.type
        };

        if(excuse.type === 'self') {
            const elapsedMin = Math.floor((this.state.originalTime - this.state.timeLeft) / 60);
            const remainingMin = this.state.plannedMinutes - elapsedMin;
            
            if(this.state.targetAmount > 0) {
                // 機会損失の計算式：残り時間 ÷ セッション予定時間 × 目標数
                const lostItems = Math.max(0, Math.floor((remainingMin / this.state.plannedMinutes) * this.state.targetAmount));
                this.dom.lossFeedback.textContent = `放棄した${remainingMin}分で、あと${lostItems}個の作業ができた可能性があります。`;
            } else {
                this.dom.lossFeedback.textContent = `${remainingMin}分の集中時間を失いました。`;
            }
            this.switchStage('abandon-step2');
        } else {
            // Unavoidable -> Skip to eval
            this.finishAbandon();
        }
    },

    finishAbandon() {
        this.switchStage('eval');
    },

    completeSession() {
        clearInterval(this.state.timerId);
        this.state.status = 'stopped';
        this.switchStage('eval');
    },

    submitEvaluation(rate) {
        clearInterval(this.state.timerId);
        
        const isAbandoned = this.state.status === 'paused' || this.state.abandonExcuseParams.id;
        const actualMin = Math.floor((this.state.originalTime - this.state.timeLeft) / 60);

        const sessionLog = {
            date_start: this.state.startTime,
            date_end: new Date(),
            planned_minutes: this.state.plannedMinutes,
            actual_minutes: isAbandoned ? actualMin : this.state.plannedMinutes,
            goal_text: this.dom.goalInput.value,
            result: isAbandoned ? 'abandoned' : 'complete',
            excuse_id: this.state.abandonExcuseParams.id || null,
            excuse_text: this.state.abandonExcuseParams.text || null,
            excuse_type: this.state.abandonExcuseParams.type || null,
            achievement_rate: rate
        };

        Store.addSession(sessionLog);
        
        // Auto logic to V2 mapping
        this.syncToV2(sessionLog);

        // reset and go back to setup
        this.reset();
        this.renderSetup();
    },

    syncToV2(sessionLog) {
        let evalRating = '○'; // default win
        if(sessionLog.result === 'abandoned') {
            evalRating = sessionLog.excuse_type === 'force_majeure' ? '□' : '×';
        } else if(sessionLog.achievement_rate < 50) {
            evalRating = '▲';
        } else if(sessionLog.achievement_rate < 100) {
            evalRating = '△';
        }
        
        const memoStr = `[V1] ${sessionLog.goal_text || '目標なし'} (${Math.floor(sessionLog.achievement_rate)}%)`;
        
        const startMs = sessionLog.date_start.getTime();
        const actualMinutes = sessionLog.actual_minutes > 0 ? sessionLog.actual_minutes : 1;
        const endMs = startMs + actualMinutes * 60000;
        
        const slotsToUpdate = new Set();
        // Extract touched 15-min slots by sampling every 1 minute
        for(let time = startMs; time <= endMs; time += 60000) {
            slotsToUpdate.add(Store.timeToSlotStr(new Date(time)));
        }

        const todayStr = Store.getTodayStr(); 
        slotsToUpdate.forEach(slotStr => {
            Store.updateSlot(todayStr, slotStr, {
                evaluation: evalRating,
                memo: memoStr,
                source: 'auto_v1'
            });
        });
    },

    reset() {
        this.state = {
            timerId: null,
            timeLeft: 0,
            originalTime: 0,
            plannedMinutes: 25,
            targetAmount: 0,
            startTime: null,
            pauseTime: null,
            stage: 'setup',
            status: 'stopped',
            abandonExcuseParams: {}
        };
        this.dom.goalInput.value = '';
    },

    updateTimeDisplay(seconds, htmlEl) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        htmlEl.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    },

    updateRing(left, total) {
        if(!this.dom.ringCircle || total === 0) return;
        const progress = left / total;
        const offset = this.circumference - progress * this.circumference;
        this.dom.ringCircle.style.strokeDashoffset = offset;
        
        // Color transition
        if(progress > 0.5) this.dom.ringCircle.style.stroke = 'var(--accent-blue)';
        else if (progress > 0.2) this.dom.ringCircle.style.stroke = 'var(--accent-orange)';
        else this.dom.ringCircle.style.stroke = 'var(--accent-red)';
    }
};
