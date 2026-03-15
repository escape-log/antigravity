// UUID Generator
function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

const DEFAULT_EXCUSES = [
    { id: 1, text: 'SNS・スマホをいじってしまった', type: 'self' },
    { id: 2, text: '気が乗らなかった', type: 'self' },
    { id: 3, text: '宅配便・来客', type: 'force_majeure' },
    { id: 4, text: '急な電話・連絡対応', type: 'force_majeure' },
    { id: 5, text: '緊急の用事が入った', type: 'force_majeure' }
];

const DEFAULT_SETTINGS = {
    timerSlots: [25, 45, 60, 90], // 25 is fixed implicitly, but stored here for UI
    excuses: DEFAULT_EXCUSES,
    forceMajeureThreshold: 30, // %
    reminders: ["12:00", "20:45", "21:45"],
    hasSeenOnboarding: false
};

const Store = {
    // ---- Basic Get/Set ----
    get(key, defaultVal) {
        const val = localStorage.getItem(`antigrav_${key}`);
        return val ? JSON.parse(val) : defaultVal;
    },
    set(key, val) {
        localStorage.setItem(`antigrav_${key}`, JSON.stringify(val));
    },

    // ---- Settings ----
    getSettings() {
        return this.get('settings', DEFAULT_SETTINGS);
    },
    updateSettings(newSettings) {
        const current = this.getSettings();
        this.set('settings', { ...current, ...newSettings });
    },

    // ---- V1 Session Logs ----
    getSessions() {
        return this.get('sessions', []);
    },
    addSession(session) {
        const sessions = this.getSessions();
        sessions.push({
            ...session,
            session_id: uuidv4()
        });
        this.set('sessions', sessions);
    },
    getLastAbandonedSession() {
        const sessions = this.getSessions();
        const abandoned = sessions.filter(s => s.result === 'abandoned');
        return abandoned.length > 0 ? abandoned[abandoned.length - 1] : null;
    },

    // ---- V2 24h Slots ----
    // key is 'YYYY-MM-DD'
    getSlotsForDate(dateStr) {
        return this.get(`slots_${dateStr}`, {});
    },
    updateSlot(dateStr, timeStr, data) {
        const slots = this.getSlotsForDate(dateStr);
        slots[timeStr] = { ...slots[timeStr], ...data };
        this.set(`slots_${dateStr}`, slots);
    },
    getSlot(dateStr, timeStr) {
        const slots = this.getSlotsForDate(dateStr);
        return slots[timeStr] || { evaluation: null, plan: '', actual: '', memo: '', source: 'manual' };
    },

    // Format Helpers
    getTodayStr() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    },
    
    // Calculates what 15m slot a given time belongs to (e.g., 14:32 -> 14:30)
    timeToSlotStr(date) {
        let d = date;
        if (typeof d === 'string') d = new Date(d); // String fallback
        let h = d.getHours();
        let m = d.getMinutes();
        let slotM = Math.floor(m / 15) * 15;
        return `${String(h).padStart(2,'0')}:${String(slotM).padStart(2,'0')}`;
    }
};
