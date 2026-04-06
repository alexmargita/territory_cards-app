// ОНОВЛЕНО: Повернуто код реєстрації Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(registration => {
      console.log('ServiceWorker registration successful with scope: ', registration.scope);
    }, err => {
      console.log('ServiceWorker registration failed: ', err);
    });
  });
}

const GITHUB_BASE_URL = "https://raw.githubusercontent.com/alexmargita/territory_cards-app/main/images/";
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwNlnmNwi2adHqGtxBRoer2-jvJWwkrr-gt3z6ZqpAtF1wIKsiWxa2HWi0HK_H4gdny/exec";

document.addEventListener('DOMContentLoaded', function() {
    const tg = window.Telegram.WebApp;
    tg.expand();

    // --- DOM елементи ---
    const appContainer = document.querySelector('.app-container');
    const loader = document.getElementById('loader');
    const myTerritoryList = document.getElementById('my-territory-list');
    const freeTerritoryList = document.getElementById('territory-list');
    const generalMapsList = document.getElementById('general-maps-list');
    const freeTerritoriesTitle = document.getElementById('free-territories-title');
    const filtersContainer = document.getElementById('filters-container');
    const imageModal = document.getElementById('image-modal');
    const fullImage = document.getElementById('full-image');
    const closeModalBtn = document.querySelector('.modal-close-btn');
    const modalDownloadBtn = document.getElementById('modal-download-btn');
    const allTerritoriesTabBtn = document.querySelector('.tab-button[data-tab="all-territories"]');
    const adminPanelControls = document.getElementById('admin-panel-controls');
    const adminTerritoryList = document.getElementById('admin-territory-list');
    const generalModal = document.getElementById('general-modal');
    const generalModalTitle = document.getElementById('general-modal-title');
    const generalModalBody = document.getElementById('general-modal-body');
    const generalModalCloseBtn = document.querySelector('.general-modal-close-btn');
    const bulkActionBar = document.getElementById('bulk-action-bar');

    // --- Глобальні змінні ---
    let allTerritories = [];
    let allUsers = [];
    let isAdmin = false;
    let displayedAdminTerritories = [];
    let predefinedFilterOrder = [];
    let selectedLocalities = []; 
    let selectedUsers = [];
    let currentAdminSortKey = 'id';
    let bulkActionMode = 'none';
    let selectedTerritoriesForBulk = [];
    let journalEntriesCache = [];
    let journalSortKey = 'date'; // Стан сортування журналу
    let journalSortDirection = 'desc'; // Напрямок сортування журналу
    const userId = tg.initDataUnsafe.user ? tg.initDataUnsafe.user.id : null;
    
    // --- Ініціалізація вкладок ---
    const tabs = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        if (bulkActionMode !== 'none') return;
        
        const targetTabId = tab.dataset.tab; // Отримуємо ID вкладки

        // Оновлюємо дані для всіх вкладок, ОКРІМ 'general-maps'
        if (targetTabId !== 'general-maps') {
            fetchAllData();
        }
        
        tabs.forEach(item => item.classList.remove('active'));
        tab.classList.add('active');
        const targetTabContent = document.getElementById(targetTabId);
        tabContents.forEach(content => content.classList.remove('active'));
        targetTabContent.classList.add('active');
    });
});
    
    // --- ОСНОВНІ ФУНКЦІЇ ЗАВАНТАЖЕННЯ ДАНИХ ---

    function fetchAllData() {
        if (!userId) {
            document.body.innerHTML = '<p>Не вдалося ідентифікувати користувача. Спробуйте перезапустити додаток.</p>';
            return;
        }
        loader.style.display = 'block';
        appContainer.classList.add('is-loading');
        
        Promise.all([
            fetch(`${SCRIPT_URL}?action=getMyTerritories&userId=${userId}`).then(res => res.json()),
            fetch(`${SCRIPT_URL}?userId=${userId}`).then(res => res.json())
        ]).then(([myData, allData]) => {
            appContainer.classList.remove('is-loading');
            loader.style.display = 'none';
            if (myData.ok) displayMyTerritories(myData.territories);
            
            if (allData.ok) {
                allTerritories = allData.territories;
                isAdmin = allData.isAdmin;

                const baseOrder = ["Тернопіль", "Березовиця", "Острів", "Буцнів"];
                const getDistance = name => {
                    const match = name.match(/\((\d+)км\)/);
                    return match ? parseInt(match[1], 10) : Infinity;
                };
                predefinedFilterOrder = allData.filters.sort((a, b) => {
                    const indexA = baseOrder.indexOf(a);
                    const indexB = baseOrder.indexOf(b);
                    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                    if (indexA !== -1) return -1;
                    if (indexB !== -1) return 1;
                    return getDistance(a) - getDistance(b);
                });

                displayFilters(predefinedFilterOrder);
                displayGeneralMaps();
                const activeFilter = document.querySelector('.filter-btn.active');
                if (activeFilter) displayFreeTerritories(activeFilter.dataset.filter);

                if (isAdmin) {
                    allTerritoriesTabBtn.style.display = 'block';
                    setupAdminPanel();
                    updateAdminFilterCounts();
                    updateAndDisplayAdminTerritories();
                    fetch(`${SCRIPT_URL}?action=getAllUsers&userId=${userId}`)
                        .then(res => res.json())
                        .then(data => { if (data.ok) allUsers = data.users; });
                }
            } else {
                 document.body.innerHTML = `<p>Помилка завантаження даних: ${allData.error}</p>`;
            }
        }).catch(error => {
            appContainer.classList.remove('is-loading');
            loader.style.display = 'none';
            console.error('Critical fetch error:', error);
            document.body.innerHTML = `<p>Критична помилка. Не вдалося завантажити дані. Перевірте з'єднання з Інтернетом.</p>`;
        });
    }

    // --- ФУНКЦІЇ ВІДОБРАЖЕННЯ (РЕНДЕРИНГУ) ---

    function createPhotoBlock(territory) {
        if (!territory.picture_id) { return `<div class="placeholder-photo">Немає фото</div>`; }
        const imageUrl = GITHUB_BASE_URL + encodeURIComponent(territory.picture_id);
        const caption = `📍 ${territory.id ? territory.id + '.' : ''} ${territory.name}`;
        return `<img class="territory-photo" src="${imageUrl}" data-photo-id="${territory.picture_id}" data-caption="${caption}" alt="Фото" loading="lazy">`;
    }
    
    function createNoteIcon(territory) {
        const noteValue = String(territory.info || '');
        if (noteValue.trim() !== '') {
            const noteText = noteValue.replace(/"/g, '&quot;');
            return `<span class="note-icon" data-note="${noteText}">i</span>`;
        }
        return '';
    }
    
    function displayMyTerritories(territories) {
        myTerritoryList.innerHTML = '';
        if (territories.length === 0) { myTerritoryList.innerHTML = '<p>На даний час ви не маєте жодної території.</p>'; return; }

        territories.sort((a, b) => parseInt(a.id) - parseInt(b.id));

        territories.forEach(t => {
            const item = document.createElement('div');
            item.className = 'territory-item';
            const remainingDays = calculateDaysRemaining(t.date_assigned);
            let daysBlock = '';
            if (remainingDays !== null) {
                const endingSoonClass = remainingDays <= 30 ? 'ending-soon' : '';
                const progressPercent = Math.max(0, (remainingDays / 120) * 100);
                daysBlock = `<div class="progress-bar-container ${endingSoonClass}"><div class="progress-bar-track"><div class="progress-bar-fill" style="width: ${progressPercent}%;"></div></div><span class="progress-bar-text">Залишилось днів: ${remainingDays}</span></div>`;
            }

            let actionButtonHtml = '';
            if (t.status === 'на поверненні') {
                actionButtonHtml = `<button class="btn-return" disabled style="background-color: #ffc107; color: #000;">⏳ Очікує...</button>`;
            } else {
                actionButtonHtml = `<button class="btn-return" data-id="${t.id}">↩️ Здати</button>`;
            }

            item.innerHTML = `<div class="territory-title"><span>📍 ${t.id}. ${t.name}</span> ${createNoteIcon(t)}</div><div class="territory-content">${createPhotoBlock(t)}<div class="action-area">${actionButtonHtml}</div></div>${daysBlock}`;
            myTerritoryList.appendChild(item);
        });
    }

    function displayFreeTerritories(filter) {
        freeTerritoryList.innerHTML = '';
        freeTerritoriesTitle.style.display = 'block';
        const filtered = allTerritories.filter(t => t.type === filter && t.category === 'territory' && t.status === 'вільна');
        if (filtered.length === 0) { freeTerritoryList.innerHTML = '<p>Вільних територій цього типу немає.</p>'; return; }
        
        filtered.sort((a, b) => parseInt(a.id) - parseInt(b.id));

        filtered.forEach(t => {
            const item = document.createElement('div');
            item.className = 'territory-item';
            item.dataset.id = t.id;
            const isPriority = isPriorityTerritory(t.date_completed);
            if (isPriority) item.classList.add('priority');
            
            const territoryNameForButton = t.name.replace(/"/g, '&quot;');
            const buttonHtml = `<button class="btn-book" data-id="${t.id}" data-name="${territoryNameForButton}">✅ Обрати</button>`;
            const noteHtml = isPriority ? `<div class="priority-note">Потребує опрацювання</div>` : '';
            const actionAreaHtml = `<div class="action-area">${buttonHtml}${noteHtml}</div>`;

            item.innerHTML = `<div class="territory-title"><span>📍 ${t.id}. ${t.name}</span> ${createNoteIcon(t)}</div><div class="territory-content">${createPhotoBlock(t)}${actionAreaHtml}</div>`;
            freeTerritoryList.appendChild(item);
        });
    }

    function displayGeneralMaps() {
        generalMapsList.innerHTML = '';
        const maps = allTerritories.filter(t => t.category === 'map');
        if (maps.length === 0) { generalMapsList.innerHTML = '<p>Загальні карти відсутні.</p>'; return; }
        maps.forEach(t => {
            const item = document.createElement('div');
            item.className = 'territory-item';
            item.innerHTML = `<div class="territory-title"><span>🗺️ ${t.name}</span> ${createNoteIcon(t)}</div>${createPhotoBlock(t)}`;
            generalMapsList.appendChild(item);
        });
    }

    function displayFilters(filters) {
        filtersContainer.innerHTML = '';
        filters.forEach((filter, index) => {
            const button = document.createElement('button');
            button.className = 'filter-btn';
            button.dataset.filter = filter;
            button.textContent = filter;
            if (index === 0) button.classList.add('active');
            filtersContainer.appendChild(button);
        });
    }

    function calculateAdminFilterCounts(territories) {
        const territoryCards = territories.filter(t => t.category === 'territory');
        return {
            all: territoryCards.filter(t => ['вільна', 'зайнята', 'повернена'].includes(t.status)).length,
            free: territoryCards.filter(t => t.status === 'вільна').length,
            assigned: territoryCards.filter(t => t.status === 'зайнята').length,
            returned: territoryCards.filter(t => t.status === 'повернена').length,
            priority: territoryCards.filter(t => isPriorityTerritory(t.date_completed)).length,
        };
    }

    function updateAdminFilterCounts() {
        const sourceTerritories = selectedLocalities.length > 0
            ? allTerritories.filter(t => selectedLocalities.includes(t.type))
            : allTerritories;
    
        const counts = calculateAdminFilterCounts(sourceTerritories);
    
        const controls = adminPanelControls;
        if (!controls.innerHTML) return; 
    
        controls.querySelector('[data-filter="all"]').textContent = `Усі (${counts.all})`;
        controls.querySelector('[data-filter="вільна"]').textContent = `Вільні (${counts.free})`;
        controls.querySelector('[data-filter="зайнята"]').textContent = `Зайняті (${counts.assigned})`;
        controls.querySelector('[data-filter="повернена"]').textContent = `Повернені (${counts.returned})`;
        controls.querySelector('[data-filter="priority"]').textContent = `Пріоритетні (${counts.priority})`;
    }

    function setupAdminPanel() {
        adminPanelControls.innerHTML = `
            <div class="admin-main-controls">
                 <div class="admin-filters">
                    <button class="admin-filter-btn active" data-filter="all">Усі</button>
                    <button class="admin-filter-btn" data-filter="вільна">Вільні</button>
                    <button class="admin-filter-btn" data-filter="зайнята">Зайняті</button>
                    <button class="admin-filter-btn" data-filter="повернена">Повернені</button>
                    <button class="admin-filter-btn" data-filter="priority">Пріоритетні</button>
                    <button id="admin-locality-filter-btn" title="Фільтр за населеним пунктом">🏙️</button>
                    <button id="admin-user-filter-btn" title="Фільтр за користувачем">👤</button>
                </div>
                <div class="admin-tools">
                    <a href="https://docs.google.com/spreadsheets/d/1E_Fgb-88CaLEUFn7Gza4a_PajLketmr2b86iYg8IyQc/edit" target="_blank" id="admin-open-sheet-btn" title="Відкрити Google Таблицю">📊</a>
                    <button id="admin-search-btn" title="Пошук">🔍</button>
                    <button id="admin-sort-btn" title="Сортування">⇅</button>
                    <button id="admin-journal-btn" title="Журнал">📓</button>
                    <div class="view-switcher">                        
                        <button class="view-btn active" data-view="list" title="Список">☰</button>
                        <button class="view-btn" data-view="grid" title="Сітка">⊞</button>
                    </div>
                </div>
            </div>
            <div class="bulk-action-controls">
                <button id="bulk-assign-btn" class="bulk-action-btn" data-mode="assign">Призначити декілька</button>
                <button id="bulk-return-btn" class="bulk-action-btn" data-mode="return">Здати декілька</button>
            </div>
        `;
    }

    function renderAdminTerritories(territories) {
        adminTerritoryList.innerHTML = '';
        if (territories.length === 0) {
            adminTerritoryList.innerHTML = '<p>Територій за вашим запитом не знайдено.</p>';
            return;
        }

        territories.forEach(t => {
            const item = document.createElement('div');
            const statusClass = { 'вільна': 'status-free', 'зайнята': 'status-assigned', 'повернена': 'status-returned' }[t.status] || '';
            item.className = `territory-item ${statusClass}`;
            item.dataset.id = t.id;
            if (isPriorityTerritory(t.date_completed)) item.classList.add('priority');
            
            let infoHtml = '';
            let daysBlock = '';

            if (t.status === 'зайнята') {
                infoHtml = `<div class="admin-card-info"><strong>Користувач:</strong> ${t.assignee_name || 'Невідомо'}<br><strong>Дата видачі:</strong> ${t.date_assigned || '-'}</div>`;
                
                const remainingDays = calculateDaysRemaining(t.date_assigned);
                if (remainingDays !== null) {
                    const endingSoonClass = remainingDays <= 30 ? 'ending-soon' : '';
                    const progressPercent = Math.max(0, (remainingDays / 120) * 100);
                    daysBlock = `<div class="progress-bar-container ${endingSoonClass}"><div class="progress-bar-track"><div class="progress-bar-fill" style="width: ${progressPercent}%;"></div></div><span class="progress-bar-text">Залишилось днів: ${remainingDays}</span></div>`;
                }

            } else if (['вільна', 'повернена'].includes(t.status)) {
                let lines = [];
                if (t.last_user_name) lines.push(`<strong>Останній користувач:</strong> ${t.last_user_name}`);
                if (t.date_completed) lines.push(`<strong>Дата повернення:</strong> ${t.date_completed}`);
                if (lines.length > 0) infoHtml = `<div class="admin-card-info">${lines.join('<br>')}</div>`;
            }
            
            const noteText = String(t.info || '').replace(/"/g, '&quot;');
            const actionsHtml = `<div class="admin-card-actions">
                    ${['вільна', 'повернена'].includes(t.status) ? `<button class="admin-btn btn-admin-assign" data-id="${t.id}">Призначити</button>` : ''}
                    ${t.status === 'повернена' ? `<button class="admin-btn btn-admin-free" data-id="${t.id}">Вільна</button>` : ''}
                    ${t.status === 'зайнята' ? `<button class="admin-btn btn-admin-return" data-id="${t.id}">Здати</button>` : ''}
                    ${t.status === 'зайнята' ? `<button class="admin-btn btn-admin-extend" data-user-id="${t.assignee_id}" data-id="${t.id}">Продовжити</button>` : ''}
                    <button class="admin-btn btn-admin-history" data-id="${t.id}">Історія</button>
                    <button class="admin-btn btn-admin-note" data-id="${t.id}" data-note="${noteText}">Примітка</button>
                </div>`;

            item.innerHTML = `<div class="territory-title"><span>📍 ${t.id}. ${t.name}</span> ${createNoteIcon(t)}</div>
                <div class="territory-content">
                    ${createPhotoBlock(t)}
                    <div class="action-area">
                        ${infoHtml}
                        ${actionsHtml}
                        ${daysBlock} 
                    </div>
                </div>`;
            adminTerritoryList.appendChild(item);
        });
    }

    function updateAndDisplayAdminTerritories() {
        let filtered = allTerritories.filter(t => t.category === 'territory');
        
        const activeFilter = adminPanelControls.querySelector('.admin-filter-btn.active')?.dataset.filter || 'all';
        const searchInput = adminPanelControls.querySelector('#admin-search-input');
        const searchQuery = searchInput ? searchInput.value : '';

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(t => String(t.id).includes(query) || t.name.toLowerCase().includes(query));
        } else {
            if (activeFilter === 'priority') {
                filtered = filtered.filter(t => isPriorityTerritory(t.date_completed));
            } else if (activeFilter !== 'all') {
                filtered = filtered.filter(t => t.status === activeFilter);
            } else {
                filtered = filtered.filter(t => ['вільна', 'зайнята', 'повернена'].includes(t.status));
            }
        }

        if (selectedLocalities.length > 0) {
            filtered = filtered.filter(t => selectedLocalities.includes(t.type));
        }
        
        if (selectedUsers.length > 0) {
            filtered = filtered.filter(t => selectedUsers.includes(String(t.assignee_id)));
        }
        
        displayedAdminTerritories = sortTerritories(filtered, currentAdminSortKey);
        renderAdminTerritories(displayedAdminTerritories);
    }
    
    function sortTerritories(territories, sortKey) {
        const sorted = [...territories];
        switch (sortKey) {
            case 'days_remaining':
                return sorted.sort((a, b) => {
                    const daysA = a.status === 'зайнята' ? calculateDaysRemaining(a.date_assigned) : -1;
                    const daysB = b.status === 'зайнята' ? calculateDaysRemaining(b.date_assigned) : -1;
                    if (daysA === -1 && daysB > -1) return 1;
                    if (daysB === -1 && daysA > -1) return -1;
                    return daysA - daysB;
                });
            case 'id':
            default:
                return sorted.sort((a, b) => parseInt(a.id) - parseInt(b.id));
        }
    }

    document.body.addEventListener('click', function(event) {
        const target = event.target;
        const territoryItem = target.closest('.territory-item');

        if (bulkActionMode !== 'none') {
            if (territoryItem) {
                handleTerritorySelection(territoryItem);
            }
        } else {
            if (target.classList.contains('note-icon')) tg.showAlert(target.dataset.note || 'Приміток немає.');
            if (target.classList.contains('territory-photo')) handlePhotoClick(target);
            if (target.classList.contains('btn-return')) handleReturnClick(target.dataset.id, target);
            if (target.classList.contains('btn-book')) handleBookClick(target.dataset.id, target.dataset.name, target);
            if (target.classList.contains('filter-btn')) handleFilterClick(target);
            if (target.classList.contains('btn-admin-assign')) handleAdminAssign(target.dataset.id);
            if (target.classList.contains('btn-admin-return')) handleAdminReturn(target.dataset.id);
            if (target.classList.contains('btn-admin-extend')) handleAdminExtend(target.dataset.id, target.dataset.userId);
            if (target.classList.contains('btn-admin-history')) handleAdminHistory(target.dataset.id);
            if (target.classList.contains('btn-admin-note')) handleAdminNote(target.dataset.id, target.dataset.note);
            if (target.classList.contains('btn-admin-free')) handleAdminMakeFree(target.dataset.id);
        }
        
        if (target.id === 'admin-search-btn') handleAdminSearch();
        if (target.id === 'admin-sort-btn') handleAdminSort();
        if (target.id === 'admin-locality-filter-btn') handleLocalityFilter();
        if (target.id === 'admin-user-filter-btn') handleUserFilter();
        if (target.id === 'admin-journal-btn') handleJournalClick();
        if (target.classList.contains('admin-filter-btn')) handleAdminFilter(target);
        if (target.classList.contains('view-btn')) handleViewSwitch(target);
        if (target.classList.contains('bulk-action-btn')) toggleBulkMode(target.dataset.mode, target);
        if (target.id === 'bulk-cancel-btn') resetBulkMode();
        
        // --- ЗМІНА ПОЧИНАЄТЬСЯ ТУТ ---
        if (target.id === 'bulk-confirm-assign-btn') handleBulkConfirmAssign();
        if (target.id === 'bulk-confirm-returned-btn') handleBulkReturn('returned');
        if (target.id === 'bulk-confirm-free-btn') handleBulkReturn('free');
        // --- КІНЕЦЬ ЗМІНИ ---
    });

    function handleReturnClick(territoryId, button) { tg.showConfirm(`Ви впевнені, що хочете надіслати запит на повернення території ${territoryId}?`, (ok) => ok && returnTerritory(territoryId, button)); }
    function handleBookClick(territoryId, territoryName, button) { tg.showConfirm(`Ви впевнені, що хочете обрати територію "${territoryId}. ${territoryName}"?`, (ok) => ok && requestTerritory(territoryId, button)); }
    function handleFilterClick(button) { filtersContainer.querySelector('.active')?.classList.remove('active'); button.classList.add('active'); displayFreeTerritories(button.dataset.filter); }
    
    function handleAdminFilter(button) { 
        adminPanelControls.querySelector('.admin-filter-btn.active')?.classList.remove('active'); 
        button.classList.add('active'); 
        const searchInput = adminPanelControls.querySelector('#admin-search-input');
        if(searchInput) searchInput.remove();
        updateAndDisplayAdminTerritories();
    }
    
    function handleViewSwitch(button) {
        const view = button.dataset.view;
        adminPanelControls.querySelector('.view-btn.active')?.classList.remove('active');
        button.classList.add('active');
        
        adminTerritoryList.classList.remove('view-list', 'view-grid');
        adminTerritoryList.classList.add(`view-${view}`);
    }

    function handleAdminSearch() {
        showCustomPrompt({ title: 'Пошук території', placeholder: 'Номер або назва', inputType: 'text', btnText: 'Знайти'
        }).then(text => {
            if (text !== null) {
                let searchInput = adminPanelControls.querySelector('#admin-search-input');
                if (!searchInput) {
                    searchInput = document.createElement('input');
                    searchInput.type = 'hidden';
                    searchInput.id = 'admin-search-input';
                    adminPanelControls.appendChild(searchInput);
                }
                searchInput.value = text;
                
                adminPanelControls.querySelector('.admin-filter-btn.active')?.classList.remove('active');
                updateAndDisplayAdminTerritories();
            }
        });
    }

    function handleAdminSort() {
        const sortOptionsHtml = `
            <ul class="modal-sort-list">
                <li data-sort="id">Номер</li>
                <li data-sort="days_remaining">Залишилось днів</li>
            </ul>
        `;
        showGeneralModal('Сортування', sortOptionsHtml);
        generalModalBody.querySelector('.modal-sort-list').onclick = e => {
            if (e.target.tagName === 'LI') {
                currentAdminSortKey = e.target.dataset.sort;
                
                const sortBtn = document.getElementById('admin-sort-btn');
                if (currentAdminSortKey === 'days_remaining') {
                    sortBtn.classList.add('active');
                } else {
                    sortBtn.classList.remove('active');
                }
                
                hideGeneralModal();
                updateAndDisplayAdminTerritories();
            }
        };
    }
    
    function handleLocalityFilter() {
        let localitiesHtml = '<ul class="modal-checkbox-list">';
        predefinedFilterOrder.forEach(locality => {
            const isChecked = selectedLocalities.includes(locality);
            localitiesHtml += `<li><label><input type="checkbox" data-locality="${locality}" ${isChecked ? 'checked' : ''}> ${locality}</label></li>`;
        });
        localitiesHtml += '</ul>';
        const modalBodyHtml = `${localitiesHtml}<button id="modal-apply-filters-btn" class="modal-save-btn">Застосувати</button>`;
        
        showGeneralModal('Фільтр за населеним пунктом', modalBodyHtml);

        document.getElementById('modal-apply-filters-btn').onclick = () => {
            const checkboxes = generalModalBody.querySelectorAll('input[type="checkbox"]');
            selectedLocalities = [];
            checkboxes.forEach(cb => {
                if (cb.checked) {
                    selectedLocalities.push(cb.dataset.locality);
                }
            });

            const filterBtn = document.getElementById('admin-locality-filter-btn');
            if (selectedLocalities.length > 0) {
                filterBtn.classList.add('active');
            } else {
                filterBtn.classList.remove('active');
            }
            
            hideGeneralModal();
            updateAdminFilterCounts();
            updateAndDisplayAdminTerritories();
        };
    }
    
    function handleUserFilter() {
        const usersWithTerritories = allTerritories.reduce((acc, territory) => {
            if (territory.status === 'зайнята' && territory.assignee_id) {
                if (!acc[territory.assignee_id]) {
                    acc[territory.assignee_id] = {
                        id: territory.assignee_id,
                        name: territory.assignee_name,
                        count: 0
                    };
                }
                acc[territory.assignee_id].count++;
            }
            return acc;
        }, {});

        const sortedUsers = Object.values(usersWithTerritories).sort((a, b) => a.name.localeCompare(b.name, 'uk'));

        let usersHtml;
        if (sortedUsers.length === 0) {
            usersHtml = '<p>На даний час немає призначених територій для фільтрації за користувачем.</p>';
        } else {
            usersHtml = '<ul class="modal-checkbox-list">';
            sortedUsers.forEach(user => {
                const isChecked = selectedUsers.includes(String(user.id));
                usersHtml += `<li><label><input type="checkbox" data-user-id="${user.id}" ${isChecked ? 'checked' : ''}> ${user.name} (${user.count})</label></li>`;
            });
            usersHtml += '</ul>';
        }

        const modalBodyHtml = `${usersHtml}<button id="modal-apply-filters-btn" class="modal-save-btn">Застосувати</button>`;
        
        showGeneralModal('Фільтр за користувачем', modalBodyHtml);

        const applyBtn = document.getElementById('modal-apply-filters-btn');
        if (applyBtn) {
            applyBtn.onclick = () => {
                const checkboxes = generalModalBody.querySelectorAll('input[type="checkbox"]');
                selectedUsers = [];
                checkboxes.forEach(cb => {
                    if (cb.checked) {
                        selectedUsers.push(cb.dataset.userId);
                    }
                });

                const filterBtn = document.getElementById('admin-user-filter-btn');
                if (selectedUsers.length > 0) {
                    filterBtn.classList.add('active');
                } else {
                    filterBtn.classList.remove('active');
                }
                
                hideGeneralModal();
                updateAndDisplayAdminTerritories();
            };
        }
    }

    // --- ЛОГІКА ДЛЯ МАСОВИХ ДІЙ ---

    // --- ЗМІНА ПОЧИНАЄТЬСЯ ТУТ ---
    function toggleBulkMode(mode, button) {
        if (bulkActionMode === mode) {
            resetBulkMode();
            return;
        }
        resetBulkMode(); 
        
        bulkActionMode = mode;
        button.classList.add('active');
        document.body.classList.add('bulk-mode-active');

        // Показуємо відповідні кнопки
        if (mode === 'assign') {
            document.getElementById('bulk-confirm-assign-btn').style.display = 'block';
        } else if (mode === 'return') {
            document.getElementById('bulk-confirm-returned-btn').style.display = 'block';
            document.getElementById('bulk-confirm-free-btn').style.display = 'block';
        }

        bulkActionBar.classList.add('visible');
    }

    function resetBulkMode() {
        if (bulkActionMode === 'none') return;
        
        bulkActionMode = 'none';
        selectedTerritoriesForBulk = [];
        
        document.body.classList.remove('bulk-mode-active');
        bulkActionBar.classList.remove('visible');

        // Приховуємо усі кнопки підтвердження
        document.getElementById('bulk-confirm-assign-btn').style.display = 'none';
        document.getElementById('bulk-confirm-returned-btn').style.display = 'none';
        document.getElementById('bulk-confirm-free-btn').style.display = 'none';
        
        document.querySelectorAll('.bulk-action-btn.active').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.territory-item.selected').forEach(item => item.classList.remove('selected'));
    }
    // --- КІНЕЦЬ ЗМІНИ ---

    function handleTerritorySelection(item) {
        const id = item.dataset.id;
        if (!id) return;

        const index = selectedTerritoriesForBulk.indexOf(id);
        if (index > -1) {
            selectedTerritoriesForBulk.splice(index, 1);
            item.classList.remove('selected');
        } else {
            selectedTerritoriesForBulk.push(id);
            item.classList.add('selected');
        }
    }

    // --- ЗМІНА ПОЧИНАЄТЬСЯ ТУТ ---
    // Нова функція для підтвердження призначення
    function handleBulkConfirmAssign() {
        if (selectedTerritoriesForBulk.length === 0) {
            tg.showAlert("Будь ласка, оберіть хоча б одну територію.");
            return;
        }

        if (allUsers.length === 0) { tg.showAlert('Список користувачів порожній.'); return; }
        let usersHtml = '<ul>' + allUsers.map(user => `<li data-user-id="${user.id}">${user.name}</li>`).join('') + '</ul>';
        showGeneralModal('Призначити ' + selectedTerritoriesForBulk.length + ' територій на:', usersHtml);

        generalModalBody.querySelector('ul').onclick = e => {
            if (e.target.tagName === 'LI') {
                const assignToUserId = e.target.dataset.userId;
                const assignToUserName = e.target.textContent;
                hideGeneralModal();
                tg.showConfirm(`Призначити ${selectedTerritoriesForBulk.length} територій користувачу ${assignToUserName}?`, (ok) => {
                    if (ok) {
                        postToServer({ 
                            action: 'adminBulkAssign', 
                            userId: userId, 
                            territoryIds: selectedTerritoriesForBulk, 
                            assignToUserId: assignToUserId 
                        }, "Призначаю...", "Не вдалося призначити території.");
                        resetBulkMode();
                    }
                });
            }
        };
    }

    // Нова функція для підтвердження повернення
    function handleBulkReturn(newStatus) {
        if (selectedTerritoriesForBulk.length === 0) {
            tg.showAlert("Будь ласка, оберіть хоча б одну територію.");
            return;
        }
        
        const statusText = newStatus === 'returned' ? "'Повернені'" : "'Вільні'";

        tg.showConfirm(`Повернути ${selectedTerritoriesForBulk.length} територій зі статусом ${statusText}?`, (ok) => {
            if (ok) {
                postToServer({ 
                    action: 'adminBulkReturn', 
                    userId: userId, 
                    territoryIds: selectedTerritoriesForBulk,
                    newStatus: newStatus // Додаємо новий статус до запиту
                }, "Надсилаю запит...", "Не вдалося надіслати запит.");
                resetBulkMode();
            }
        });
    }
    // --- КІНЕЦЬ ЗМІНИ ---

    // --- СТАНДАРТНІ ОДИНОЧНІ ДІЇ ---

    function handleAdminAssign(territoryId) {
        if (allUsers.length === 0) { tg.showAlert('Список користувачів порожній.'); return; }
        let usersHtml = '<ul>' + allUsers.map(user => `<li data-user-id="${user.id}">${user.name}</li>`).join('') + '</ul>';
        showGeneralModal('Оберіть користувача', usersHtml);
        generalModalBody.querySelector('ul').onclick = e => {
            if (e.target.tagName === 'LI') {
                const assignToUserId = e.target.dataset.userId;
                const assignToUserName = e.target.textContent;
                hideGeneralModal();
                tg.showConfirm(`Призначити територію ${territoryId} користувачу ${assignToUserName}?`, (ok) => ok && postToServer({ action: 'adminAssignTerritory', userId: userId, territoryId: territoryId, assignToUserId: assignToUserId }, "Призначаю...", "Не вдалося призначити."));
            }
        };
    }

    function handleAdminReturn(territoryId) {
        tg.showConfirm(`Надіслати запит на повернення території ${territoryId} на підтвердження?`, (ok) => ok && fetch(`${SCRIPT_URL}?action=returnTerritory&territoryId=${territoryId}&userId=${userId}`).then(r => r.json()).then(res => tg.showAlert(res.message || 'Сталася помилка.')).catch(() => tg.showAlert('Помилка мережі.')));
    }

    function handleAdminExtend(territoryId, extendForUserId) {
        tg.showConfirm(`Продовжити термін для території ${territoryId}?`, (ok) => ok && postToServer({ action: 'adminExtendTerritory', userId: userId, territoryId: territoryId, extendForUserId: extendForUserId }, "Продовжую термін...", "Не вдалося продовжити."));
    }
    
    function handleAdminHistory(territoryId) {
        tg.MainButton.setText("Завантажую історію...").show();
        fetch(`${SCRIPT_URL}?action=getTerritoryHistory&territoryId=${territoryId}&userId=${userId}`)
            .then(res => res.json())
            .then(result => {
                tg.MainButton.hide();
                if (result.ok && result.history) {
                    let historyHtml = result.history.length === 0 
                        ? '<p>Історія для цієї території відсутня.</p>'
                        : result.history.map(entry => {
                            let actionText = entry.action === 'Assigned' ? 'Взято' : 'Здано';
                            let daysText = entry.action === 'Returned' && entry.days ? ` (${entry.days} дн.)` : '';
                            return `<div class="history-entry">${entry.date} - ${actionText} - <b>${entry.user}</b>${daysText}</div>`;
                        }).join('');
                    showGeneralModal(`Історія території ${territoryId}`, historyHtml);
                } else {
                    tg.showAlert(result.error || 'Не вдалося завантажити історію.');
                }
            })
            .catch(err => {
                tg.MainButton.hide();
                tg.showAlert('Помилка мережі при завантаженні історії.');
            });
    }

    function handleAdminNote(territoryId, currentNote) {
        showCustomPrompt({ title: `Примітка до території ${territoryId}`, initialValue: currentNote, inputType: 'textarea', btnText: 'Зберегти'
        }).then(text => {
            if (text !== null) {
                postToServer({ action: 'updateTerritoryNote', userId: userId, territoryId: territoryId, note: text }, "Зберігаю...", "Не вдалося зберегти.");
            }
        });
    }

    function handleAdminMakeFree(territoryId) {
        tg.showConfirm(`Ви впевнені, що хочете змінити статус території ${territoryId} на "вільна"?`, (ok) => {
            if (ok) {
                postToServer({ 
                    action: 'adminMakeTerritoryFree', 
                    userId: userId, 
                    territoryId: territoryId 
                }, "Оновлюю статус...", "Не вдалося оновити статус.");
            }
        });
    }

    // --- ФУНКЦІЯ ДЛЯ СПОВІЩЕНЬ (TOAST) ---
    function showToast(message, duration = 3000) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = 'toast-message';
        toast.textContent = message;

        container.appendChild(toast);
        setTimeout(() => { toast.classList.add('show'); }, 10);
        setTimeout(() => {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => toast.remove());
        }, duration);
    }
    
    function postToServer(payload, loadingMsg, errorMsg) {
        return new Promise(resolve => {
            tg.MainButton.setText(loadingMsg).show();
            fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) })
            .then(response => response.json())
            .then(result => {
                tg.MainButton.hide();
                if (result.ok) { 
                    if (payload.action !== 'markJournalEntry' && payload.action !== 'sendPhotoToUser') {
                         fetchAllData();
                    }
                    showToast(result.message || "Успішно виконано!");
                    resolve(true);
                } else { 
                    tg.showAlert(result.error || errorMsg); 
                    resolve(false);
                }
            })
            .catch(error => { 
                tg.MainButton.hide(); 
                tg.showAlert('Критична помилка. Не вдалося виконати запит.'); 
                resolve(false);
            });
        });
    }

function returnTerritory(territoryId, buttonElement) {
    tg.MainButton.setText("Надсилаю запит...").show();
    fetch(`${SCRIPT_URL}?action=returnTerritory&territoryId=${territoryId}&userId=${userId}`)
        .then(response => response.json())
        .then(result => {
            tg.MainButton.hide();
            if (result.ok) { 
                showToast(result.message);
                fetchAllData(); // Оновлюємо всі дані після успішного запиту
            } else { 
                tg.showAlert(result.message || 'Сталася невідома помилка.'); 
                fetchAllData(); // Оновлюємо дані, навіть якщо сталася помилка
            }
        })
        .catch(error => { tg.MainButton.hide(); tg.showAlert('Сталася критична помилка. Спробуйте пізніше.'); });
}

function requestTerritory(territoryId, buttonElement) {
    tg.MainButton.setText("Надсилаю запит...").show();
    fetch(`${SCRIPT_URL}?action=requestTerritory&territoryId=${territoryId}&userId=${userId}`)
        .then(response => response.json())
        .then(result => {
            tg.MainButton.hide();
            if (result.ok) {
                showToast(result.message);
                fetchAllData(); // Оновлюємо всі дані, щоб прибрати територію зі списку вільних
            } else { 
                tg.showAlert(result.message || 'Сталася невідома помилка.'); 
                fetchAllData(); // Оновлюємо дані, щоб побачити актуальний статус території, якщо її хтось забронював раніше
            }
        })
        .catch(error => { tg.MainButton.hide(); tg.showAlert('Сталася критична помилка. Спробуйте пізніше.'); });
}
    
    function calculateDaysRemaining(assignDateStr) {
        if (!assignDateStr || typeof assignDateStr !== 'string') return null;
        const parts = assignDateStr.split('.');
        if (parts.length !== 3) return null;
        const assigned = new Date(parts[2], parts[1] - 1, parts[0]);
        if (isNaN(assigned.getTime())) return null;
        const deadline = new Date(assigned.getTime());
        deadline.setDate(deadline.getDate() + 120);
        const today = new Date();
        const diffTime = deadline - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > 0 ? diffDays : 0;
    }

    function isPriorityTerritory(completedDateStr) {
        if (!completedDateStr || typeof completedDateStr !== 'string') return false;
        const parts = completedDateStr.split('.');
        if (parts.length !== 3) return false;
        const completedDate = new Date(parts[2], parts[1] - 1, parts[0]);
        if (isNaN(completedDate.getTime())) return false;
        const today = new Date();
        const diffTime = today.getTime() - completedDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return diffDays >= 240;
    }

    function handlePhotoClick(photoElement) {
        fullImage.src = photoElement.src;
        imageModal.dataset.photoId = photoElement.dataset.photoId;
        imageModal.dataset.caption = photoElement.dataset.caption;
        imageModal.classList.add('active');
    }
    closeModalBtn.addEventListener('click', () => { imageModal.classList.remove('active'); resetTransform(); });
    imageModal.addEventListener('click', (e) => { if (e.target === imageModal || e.target.classList.contains('modal-image-container')) { imageModal.classList.remove('active'); resetTransform(); } });
    
    modalDownloadBtn.addEventListener('click', () => {
        const photoId = imageModal.dataset.photoId;
        const caption = imageModal.dataset.caption;
        if (!photoId || !caption) { 
            tg.showAlert('Не вдалося отримати дані для надсилання.'); 
            return; 
        }
        imageModal.classList.remove('active');
        resetTransform();
        postToServer({ action: 'sendPhotoToUser', userId: userId, photoId: photoId, caption: caption }, "Завантажую картку...", "Не вдалося завантажити картку");
    });
    
    let scale = 1, isPanning = false, startX = 0, startY = 0, translateX = 0, translateY = 0, initialPinchDistance = null;
    function updateTransform() { fullImage.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`; }
    function resetTransform() { scale = 1; translateX = 0; translateY = 0; updateTransform(); }
    imageModal.addEventListener('wheel', (e) => { e.preventDefault(); const delta = e.deltaY > 0 ? -0.1 : 0.1; scale = Math.max(1, Math.min(scale + delta, 5)); if (scale === 1) { translateX = 0; translateY = 0; } updateTransform(); });
    imageModal.addEventListener('mousedown', (e) => { if (e.target !== fullImage || scale <= 1) return; e.preventDefault(); isPanning = true; fullImage.classList.add('grabbing'); startX = e.clientX - translateX; startY = e.clientY - translateY; });
    imageModal.addEventListener('mousemove', (e) => { if (!isPanning) return; e.preventDefault(); translateX = e.clientX - startX; translateY = e.clientY - startY; updateTransform(); });
    window.addEventListener('mouseup', () => { isPanning = false; fullImage.classList.remove('grabbing'); });
    function getDistance(touches) { const [t1, t2] = touches; return Math.sqrt(Math.pow(t2.clientX - t1.clientX, 2) + Math.pow(t2.clientY - t1.clientY, 2)); }
    imageModal.addEventListener('touchstart', (e) => { if (e.target !== fullImage || e.touches.length > 2) return; if (e.touches.length === 1 && scale > 1) { isPanning = true; fullImage.classList.add('grabbing'); startX = e.touches[0].clientX - translateX; startY = e.touches[0].clientY - translateY; } else if (e.touches.length === 2) { isPanning = false; initialPinchDistance = getDistance(e.touches); } });
    imageModal.addEventListener('touchmove', (e) => { if (e.target !== fullImage) return; e.preventDefault(); if (isPanning && e.touches.length === 1) { translateX = e.touches[0].clientX - startX; translateY = e.touches[0].clientY - startY; updateTransform(); } else if (e.touches.length === 2 && initialPinchDistance) { const newDist = getDistance(e.touches); scale = Math.max(1, Math.min(scale * (newDist / initialPinchDistance), 5)); if (scale === 1) { translateX = 0; translateY = 0; } updateTransform(); initialPinchDistance = newDist; } });
    imageModal.addEventListener('touchend', (e) => { if (e.touches.length < 2) initialPinchDistance = null; if (e.touches.length < 1) { isPanning = false; fullImage.classList.remove('grabbing'); } });

    function showGeneralModal(title, bodyHtml) { generalModalTitle.innerHTML = title; generalModalBody.innerHTML = bodyHtml; generalModal.style.display = 'flex'; }
    function hideGeneralModal() { generalModal.style.display = 'none'; generalModalTitle.innerHTML = ''; generalModalBody.innerHTML = ''; }
    generalModalCloseBtn.addEventListener('click', hideGeneralModal);
    generalModal.addEventListener('click', e => { if(e.target === generalModal) hideGeneralModal(); });

    function showCustomPrompt(options) {
        return new Promise(resolve => {
            const inputHtml = options.inputType === 'textarea' ? `<textarea id="modal-input-field" class="modal-textarea" placeholder="${options.placeholder || ''}">${options.initialValue || ''}</textarea>` : `<input id="modal-input-field" class="modal-input" type="text" placeholder="${options.placeholder || ''}" value="${options.initialValue || ''}">`;
            const bodyHtml = `${inputHtml}<button id="modal-save-btn" class="modal-save-btn">${options.btnText || 'Зберегти'}</button>`;
            showGeneralModal(options.title, bodyHtml);
            
            const inputField = document.getElementById('modal-input-field');
            const saveBtn = document.getElementById('modal-save-btn');
            
            const closeModalAndResolve = (value) => { hideGeneralModal(); resolve(value); };
            saveBtn.onclick = () => closeModalAndResolve(inputField.value);
            generalModal.querySelector('.general-modal-close-btn').onclick = () => closeModalAndResolve(null);
            generalModal.addEventListener('click', e => { if (e.target === generalModal) closeModalAndResolve(null); }, { once: true });
        });
    }
    
    // --- ОНОВЛЕНІ ФУНКЦІЇ ДЛЯ ЖУРНАЛУ ---
    function handleJournalClick() {
        loader.style.display = 'block';
        fetch(`${SCRIPT_URL}?action=getJournalHistory&userId=${userId}`)
            .then(res => res.json())
            .then(result => {
                loader.style.display = 'none';
                if (result.ok && result.history) {
                    journalEntriesCache = result.history;
                    // Скидаємо сортування до початкового стану при кожному відкритті
                    journalSortKey = 'date';
                    journalSortDirection = 'desc';
                    displayJournal();
                } else {
                    tg.showAlert(result.error || 'Не вдалося завантажити журнал.');
                }
            })
            .catch(err => {
                loader.style.display = 'none';
                tg.showAlert('Помилка мережі при завантаженні журналу.');
            });
    }

    function displayJournal() {
// Безпечний парсинг дати (захист від порожніх значень)
        const parseDateForSort = (dateStr) => {
            if (!dateStr) return new Date(0);
            const parts = String(dateStr).split('.');
            if (parts.length !== 3) return new Date(0);
            return new Date(parts[2], parts[1] - 1, parts[0]);
        };

        const sortedEntries = [...journalEntriesCache].sort((a, b) => {
            let comparison = 0;
            switch (journalSortKey) {
                case 'id':
                    // Безпечне перетворення на число (відкидає літери, наприклад з "12А" зробить 12)
                    const idA = parseInt(a.territoryId) || 0;
                    const idB = parseInt(b.territoryId) || 0;
                    comparison = idA - idB;

                    // Якщо цифри однакові, порівнюємо їх як текст (щоб "12А" і "12Б" стали по черзі)
                    if (comparison === 0) {
                        comparison = String(a.territoryId).localeCompare(String(b.territoryId));
                    }

                    // Якщо номери повністю ідентичні, сортуємо за дією: "Взяв" -> "Здав"
                    if (comparison === 0) {
                        let actionA = a.action === 'Assigned' ? 0 : 1;
                        let actionB = b.action === 'Assigned' ? 0 : 1;
                        comparison = actionA - actionB;
                        
                        // Компенсуємо реверс, щоб "Взяв" ЗАВЖДИ було вище за "Здав",
                        // навіть якщо користувач натиснув сортування "за спаданням"
                        if (journalSortDirection === 'desc') {
                            comparison = -comparison; 
                        }
                    }
                    break;
                case 'user':
                    comparison = a.user.localeCompare(b.user, 'uk');
                    break;
                case 'date':
                default:
                    const timeA = parseDateForSort(a.date).getTime() || 0;
                    const timeB = parseDateForSort(b.date).getTime() || 0;
                    comparison = timeA - timeB;
                    // Якщо дати однакові, зберігаємо хронологію: новіші записи вище
                    if (comparison === 0) {
                        comparison = b.rowId - a.rowId; 
                    }
                    break;
            }
            return journalSortDirection === 'asc' ? comparison : -comparison;
        });
        
        const sortControlsHtml = `
            <div class="journal-sort-controls">
                <span>Сортувати:</span>
                <button class="journal-sort-btn ${journalSortKey === 'date' ? 'active' : ''}" data-sort="date">Дата</button>
                <button class="journal-sort-btn ${journalSortKey === 'id' ? 'active' : ''}" data-sort="id">Номер</button>
                <button class="journal-sort-btn ${journalSortKey === 'user' ? 'active' : ''}" data-sort="user">Користувач</button>
                <button id="journal-sort-direction-btn" class="journal-sort-btn ${journalSortDirection}" title="Змінити напрямок">⇅</button>
            </div>`;

        let listHtml;
        if (sortedEntries.length === 0) {
            listHtml = '<p style="text-align: center; padding: 20px;">Нових записів немає.</p>';
        } else {
            // Додано max-height та overflow-y для можливості прокручувати довгий список
            listHtml = '<ul class="journal-list" style="max-height: 60vh; overflow-y: auto; overflow-x: hidden; padding-right: 5px;">';
            sortedEntries.forEach(entry => {
                const actionText = entry.action === 'Assigned' ? 'взяв' : 'здав';
                const actionClass = entry.action === 'Assigned' ? 'action-took' : 'action-returned';
                listHtml += `
                    <li class="journal-entry" data-row-id="${entry.rowId}">
                        <span class="journal-entry-text"><b>${entry.territoryId}</b> <span class="${actionClass}">${actionText}</span> ${entry.user} ${entry.date}</span>
                        <button class="journal-mark-btn" title="Відмітити як внесене">✓</button>
                    </li>`;
            });
            listHtml += '</ul>';
        }
        
        showGeneralModal('Журнал операцій', sortControlsHtml + listHtml);
    }
    
    generalModalBody.addEventListener('click', function(event) {
        const markBtn = event.target.closest('.journal-mark-btn');
        const sortBtn = event.target.closest('.journal-sort-btn[data-sort]');
        const directionBtn = event.target.closest('#journal-sort-direction-btn');

        if (markBtn) {
            const entryElement = markBtn.closest('.journal-entry');
            const rowId = parseInt(entryElement.dataset.rowId, 10);
            
            markBtn.disabled = true;

            postToServer({ action: 'markJournalEntry', userId: userId, rowId: rowId }, "Відмічаю...", "Не вдалося відмітити.")
            .then(success => {
                if (success) {
                    journalEntriesCache = journalEntriesCache.filter(entry => entry.rowId !== rowId);
                    entryElement.classList.add('marked');
                    entryElement.addEventListener('transitionend', () => {
                        entryElement.remove();
                        if (generalModalBody.querySelectorAll('.journal-entry:not(.marked)').length === 0) {
                            const sortControls = generalModalBody.querySelector('.journal-sort-controls');
                            generalModalBody.innerHTML = sortControls.outerHTML + '<p style="text-align: center; padding: 20px;">Усі записи відмічено.</p>';
                        }
                    });
                } else {
                    markBtn.disabled = false;
                }
            });
        }

        if (sortBtn) {
            const newSortKey = sortBtn.dataset.sort;
            if (journalSortKey === newSortKey) {
                // Якщо клікнули на ту ж кнопку, міняємо напрямок
                journalSortDirection = journalSortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                // Якщо клікнули на нову кнопку, встановлюємо її і скидаємо напрямок
                journalSortKey = newSortKey;
                journalSortDirection = (journalSortKey === 'date') ? 'desc' : 'asc'; // За замовчуванням: дата - новіші, решта - по зростанню
            }
            displayJournal();
        }

        if (directionBtn) {
            journalSortDirection = journalSortDirection === 'asc' ? 'desc' : 'asc';
            displayJournal();
        }
    });

    fetchAllData();
});