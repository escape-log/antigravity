document.addEventListener('DOMContentLoaded', () => {
    // Check initial onboarding
    const settings = Store.getSettings();
    if(!settings.hasSeenOnboarding) {
        document.getElementById('onboarding-modal').classList.remove('hidden');
    }

    // Bind basic flow events
    document.getElementById('btn-onboarding-start').addEventListener('click', () => {
        document.getElementById('onboarding-modal').classList.add('hidden');
        Store.updateSettings({ hasSeenOnboarding: true });
    });

    const views = {
        v1: document.getElementById('view-v1'),
        v2: document.getElementById('view-v2'),
        settings: document.getElementById('view-settings'),
        stats: document.getElementById('view-stats')
    };

    const navBtnV1V2 = document.getElementById('nav-btn-v1-v2');
    const btnSettings = document.getElementById('btn-settings');
    const headerTitle = document.getElementById('header-title');

    let currentView = 'v1';

    function switchView(viewName) {
        Object.values(views).forEach(v => {
            v.classList.remove('active');
            v.classList.add('hidden');
        });
        views[viewName].classList.remove('hidden');
        views[viewName].classList.add('active');
        currentView = viewName;

        switch(viewName) {
            case 'v1':
                headerTitle.textContent = 'V1 タイマー';
                navBtnV1V2.textContent = '→V2';
                navBtnV1V2.style.display = 'block';
                V1.renderSetup(); // Ensure fresh state if needed
                break;
            case 'v2':
                headerTitle.textContent = 'V2 ログ';
                navBtnV1V2.textContent = '←V1';
                navBtnV1V2.style.display = 'block';
                V2.render();
                break;
            case 'settings':
                headerTitle.textContent = '設定・統計';
                navBtnV1V2.style.display = 'none'; // hidden in settings usually
                Settings.render();
                break;
            case 'stats':
                headerTitle.textContent = '統計';
                navBtnV1V2.style.display = 'none';
                Stats.open();
                break;
        }
    }

    // Add navigation to stats from V1
    document.getElementById('btn-go-stats').addEventListener('click', () => {
        switchView('stats');
    });

    // Add back button from stats
    document.getElementById('btn-stats-back').addEventListener('click', () => {
        switchView('v1');
    });

    navBtnV1V2.addEventListener('click', () => {
        if(currentView === 'v1') switchView('v2');
        else switchView('v1');
    });

    btnSettings.addEventListener('click', () => {
        if(currentView === 'settings') {
            switchView('v1'); // back to home
            btnSettings.textContent = '⚙️';
        } else {
            switchView('settings');
            btnSettings.textContent = '✕';
        }
    });

    // Initialize Sub-modules
    V1.init();
    V2.init();
    Settings.init();
    Stats.init();
    
    // Set initial view
    switchView('v1');
});
