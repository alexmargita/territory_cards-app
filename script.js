// Реєстрація Service Worker для кешування
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
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwFJLXdMCYUo_O2EkyfvK3VMI_YHExnsUiS-5jVKiXsKz35Mr8JlH1DMD9BHuVsf_Gu/exec";

document.addEventListener('DOMContentLoaded', function() {
    const tg = window.Telegram.WebApp;
    tg.expand();

    // --- DOM елементи ---
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

    // --- Глобальні змінні ---
    let allTerritories = [];
    let allUsers = [];
    let isAdmin = false;
    const userId = tg.initDataUnsafe.user ? tg.initDataUnsafe.user.id : null;
    
    // --- Ініціалізація вкладок ---
    const tabs = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(item => item.classList.remove('active'));
            tab.classList.add('active');
            const targetTabId = tab.dataset.tab;
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
        myTerritoryList.innerHTML = '';
        freeTerritoryList.innerHTML = '';
        generalMapsList.innerHTML = '';
        
        Promise.all([
            fetch(`${SCRIPT_URL}?action=getMyTerritories&userId=${userId}`).then(res => res.json()),
            fetch(`${SCRIPT_URL}?userId=${userId}`).then(res => res.json())
        ]).then(([myData, allData]) => {
            loader.style.display = 'none';
            if (myData.ok) displayMyTerritories(myData.territories);
            
            if (allData.ok) {
                allTerritories = allData.territories;
                isAdmin = allData.isAdmin;

                // Сортування фільтрів
                const predefinedOrder = ["Тернопіль", "Березовиця", "Острів", "Буцнів"];
                const getDistance = name => {
                    const match = name.match(/\((\d+)км\)/);
                    return match ? parseInt(match[1], 10) : Infinity;
                };
                const sortedFilters = allData.filters.sort((a, b) => {
                    const indexA = predefinedOrder.indexOf(a);
                    const indexB = predefinedOrder.indexOf(b);
                    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                    if (indexA !== -1) return -1;
                    if (indexB !== -1) return 1;
                    return getDistance(a) - getDistance(b);
                });

                displayFilters(sortedFilters);
                displayGeneralMaps();
                const activeFilter = document.querySelector('.filter-btn.active');
                if (activeFilter) displayFreeTerritories(activeFilter.dataset.filter);

                if (isAdmin) {
                    allTerritoriesTabBtn.style.display = 'block';
                    setupAdminPanel();
                    fetch(`${SCRIPT_URL}?action=getAllUsers&userId=${userId}`)
                        .then(res => res.json())
                        .then(data => { if (data.ok) allUsers = data.users; });
                }
            } else {
                 document.body.innerHTML = `<p>Помилка завантаження даних: ${allData.error}</p>`;
            }
        }).catch(error => {
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
        if (territory.info && territory.info.trim() !== '') {
            const noteText = territory.info.replace(/"/g, '&quot;');
            return `<span class="note-icon" data-note="${noteText}">i</span>`;
        }
        return '';
    }
    
    function displayMyTerritories(territories) {
        myTerritoryList.innerHTML = '';
        if (territories.length === 0) { myTerritoryList.innerHTML = '<p>На даний час ви не маєте жодної території.</p>'; return; }
        territories.forEach(t => {
            const item = document.createElement('div');
            item.className = 'territory-item';
            const remainingDays = calculateDaysRemaining(t.date_assigned);
            let daysBlock = '';
            if (remainingDays !== null) {
                const endingSoonClass = remainingDays <= 30 ? 'ending-soon' : '';
                const progressPercent = Math.min(((120 - remainingDays) / 120) * 100, 100);
                daysBlock = `<div class="progress-bar-container ${endingSoonClass}"><div class="progress-bar-track"><div class="progress-bar-fill" style="width: ${progressPercent}%;"></div></div><span class="progress-bar-text">Залишилось днів: ${remainingDays}</span></div>`;
            }
            item.innerHTML = `<div class="territory-title"><span>📍 ${t.id}. ${t.name}</span> ${createNoteIcon(t)}</div><div class="territory-content">${createPhotoBlock(t)}<div class="action-area"><button class="btn-return" data-id="${t.id}">↩️ Здати</button></div></div>${daysBlock}`;
            myTerritoryList.appendChild(item);
        });
    }

    function displayFreeTerritories(filter) {
        freeTerritoryList.innerHTML = '';
        freeTerritoriesTitle.style.display = 'block';
        const filtered = allTerritories.filter(t => t.type === filter && t.category === 'territory' && t.status === 'вільна');
        if (filtered.length === 0) { freeTerritoryList.innerHTML = '<p>Вільних територій цього типу немає.</p>'; return; }
        
        filtered.forEach(t => {
            const item = document.createElement('div');
            item.className = 'territory-item';
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

    // --- ЛОГІКА АДМІН-ПАНЕЛІ ---

    function setupAdminPanel() {
        adminPanelControls.innerHTML = `
            <button class="admin-filter-btn active" data-filter="all">Усі</button>
            <button class="admin-filter-btn" data-filter="вільна">Вільні</button>
            <button class="admin-filter-btn" data-filter="зайнята">Зайняті</button>
            <button class="admin-filter-btn" data-filter="повернена">Повернені</button>
            <button class="admin-filter-btn" data-filter="priority">Рідко опрацьовані</button>
            <button id="admin-search-btn">🔍</button>
        `;
        displayAllTerritoriesForAdmin('all', '');

        adminPanelControls.addEventListener('click', e => {
            if (e.target.classList.contains('admin-filter-btn')) {
                adminPanelControls.querySelector('.active')?.classList.remove('active');
                e.target.classList.add('active');
                displayAllTerritoriesForAdmin(e.target.dataset.filter, '');
            } else if (e.target.id === 'admin-search-btn') {
                tg.showPopup({
                    title: 'Пошук території',
                    message: 'Введіть номер або назву території:',
                    buttons: [{id: 'search', type: 'default', text: 'Знайти'}, {type: 'cancel'}]
                }, (btnId, text) => {
                    if (btnId === 'search' && text) {
                        adminPanelControls.querySelector('.active')?.classList.remove('active');
                        displayAllTerritoriesForAdmin('all', text);
                    }
                });
            }
        });
    }

    function displayAllTerritoriesForAdmin(filter, searchQuery) {
        adminTerritoryList.innerHTML = '';
        let filtered = allTerritories.filter(t => t.category === 'territory');
        
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(t => String(t.id).includes(query) || t.name.toLowerCase().includes(query));
        } else {
            if (filter === 'priority') {
                filtered = filtered.filter(t => isPriorityTerritory(t.date_completed));
            } else if (filter !== 'all') {
                filtered = filtered.filter(t => t.status === filter);
            } else {
                filtered = filtered.filter(t => ['вільна', 'зайнята', 'повернена'].includes(t.status));
            }
        }
        
        if (filtered.length === 0) {
            adminTerritoryList.innerHTML = '<p>Територій за вашим запитом не знайдено.</p>';
            return;
        }

        filtered.forEach(t => {
            const item = document.createElement('div');
            const statusClass = { 'вільна': 'status-free', 'зайнята': 'status-assigned', 'повернена': 'status-returned', 'в очікуванні': 'status-pending' }[t.status] || '';
            item.className = `territory-item ${statusClass}`;
            
            let infoHtml = '';
            if (t.status === 'зайнята') {
                infoHtml = `<div class="admin-card-info">
                    <strong>Користувач:</strong> ${t.assignee_name || 'Невідомо'}<br>
                    <strong>Дата видачі:</strong> ${t.date_assigned || '-'}
                </div>`;
            }
            
            const noteText = t.info ? t.info.replace(/"/g, '&quot;') : '';

            item.innerHTML = `
                <div class="territory-title"><span>📍 ${t.id}. ${t.name}</span> ${createNoteIcon(t)}</div>
                ${infoHtml}
                <div class="admin-card-actions">
                    <button class="admin-btn btn-admin-assign" data-id="${t.id}">Призначити</button>
                    <button class="admin-btn btn-admin-return" data-id="${t.id}" ${t.status !== 'зайнята' ? 'disabled' : ''}>Здати</button>
                    <button class="admin-btn btn-admin-extend" data-user-id="${t.assignee_id}" data-id="${t.id}" ${t.status !== 'зайнята' ? 'disabled' : ''}>Продовжити</button>
                    <button class="admin-btn btn-admin-history" data-id="${t.id}">Історія</button>
                    <button class="admin-btn btn-admin-note" data-id="${t.id}" data-note="${noteText}">Примітка</button>
                </div>`;
            adminTerritoryList.appendChild(item);
        });
    }

    // --- ОБРОБНИКИ ПОДІЙ ---

    document.body.addEventListener('click', function(event) {
        const target = event.target;
        if (target.classList.contains('note-icon')) tg.showAlert(target.dataset.note || 'Приміток немає.');
        if (target.classList.contains('territory-photo')) handlePhotoClick(target);
        if (target.classList.contains('btn-return')) handleReturnClick(target.dataset.id, target);
        if (target.classList.contains('btn-book')) handleBookClick(target.dataset.id, target.dataset.name, target);
        if (target.classList.contains('filter-btn')) handleFilterClick(target);
        // Адмін-кнопки
        if (target.classList.contains('btn-admin-assign')) handleAdminAssign(target.dataset.id);
        if (target.classList.contains('btn-admin-return')) handleAdminReturn(target.dataset.id);
        if (target.classList.contains('btn-admin-extend')) handleAdminExtend(target.dataset.id, target.dataset.userId);
        if (target.classList.contains('btn-admin-history')) handleAdminHistory(target.dataset.id);
        if (target.classList.contains('btn-admin-note')) handleAdminNote(target.dataset.id, target.dataset.note);
    });

    function handleReturnClick(territoryId, button) {
        tg.showConfirm(`Ви впевнені, що хочете надіслати запит на повернення території ${territoryId}?`, (isConfirmed) => {
            if (isConfirmed) returnTerritory(territoryId, button);
        });
    }
    function handleBookClick(territoryId, territoryName, button) {
        tg.showConfirm(`Ви впевнені, що хочете обрати територію "${territoryId}. ${territoryName}"?`, (isConfirmed) => {
            if (isConfirmed) requestTerritory(territoryId, button);
        });
    }
    function handleFilterClick(button) {
        filtersContainer.querySelector('.active')?.classList.remove('active');
        button.classList.add('active');
        displayFreeTerritories(button.dataset.filter);
    }
    
    // --- ОБРОБНИКИ ДЛЯ АДМІН-КНОПОК ---

    function handleAdminAssign(territoryId) {
        if (allUsers.length === 0) { tg.showAlert('Список користувачів порожній або ще завантажується.'); return; }
        
        let usersHtml = '<ul>';
        allUsers.forEach(user => {
            usersHtml += `<li data-user-id="${user.id}">${user.name}</li>`;
        });
        usersHtml += '</ul>';

        showGeneralModal('Оберіть користувача', usersHtml);

        generalModalBody.querySelector('ul').addEventListener('click', e => {
            if (e.target.tagName === 'LI') {
                const assignToUserId = e.target.dataset.userId;
                const assignToUserName = e.target.textContent;
                hideGeneralModal();
                tg.showConfirm(`Призначити територію ${territoryId} користувачу ${assignToUserName}?`, (isConfirmed) => {
                    if (isConfirmed) {
                        const payload = { action: 'adminAssignTerritory', userId: userId, territoryId: territoryId, assignToUserId: assignToUserId };
                        postToServer(payload, "Призначаю...", "Не вдалося призначити територію.");
                    }
                });
            }
        });
    }

    function handleAdminReturn(territoryId) {
        tg.showConfirm(`Надіслати запит на повернення території ${territoryId} на підтвердження?`, (isConfirmed) => {
            if (isConfirmed) {
                 fetch(`${SCRIPT_URL}?action=returnTerritory&territoryId=${territoryId}&userId=${userId}`)
                    .then(response => response.json())
                    .then(result => {
                        if (result.ok) {
                            tg.showAlert(result.message);
                        } else {
                            tg.showAlert(result.message || 'Сталася помилка.');
                        }
                    }).catch(err => tg.showAlert('Помилка мережі.'));
            }
        });
    }

    function handleAdminExtend(territoryId, extendForUserId) {
        tg.showConfirm(`Продовжити термін для території ${territoryId}?`, (isConfirmed) => {
            if (isConfirmed) {
                const payload = { action: 'adminExtendTerritory', userId: userId, territoryId: territoryId, extendForUserId: extendForUserId };
                postToServer(payload, "Продовжую термін...", "Не вдалося продовжити термін.");
            }
        });
    }
    
    function handleAdminHistory(territoryId) {
        tg.MainButton.setText("Завантажую історію...").show();
        fetch(`${SCRIPT_URL}?action=getTerritoryHistory&territoryId=${territoryId}&userId=${userId}`)
            .then(res => res.json())
            .then(result => {
                tg.MainButton.hide();
                if (result.ok && result.history) {
                    let historyHtml = '';
                    if (result.history.length === 0) {
                        historyHtml = '<p>Історія для цієї території відсутня.</p>';
                    } else {
                         let historyPairs = [];
                         let assignments = {};
                         result.history.reverse().forEach(entry => { // Chronological
                            if(entry.action === 'Assigned') {
                                assignments[entry.user] = entry.date;
                            } else if (entry.action === 'Returned' && assignments[entry.user]) {
                                historyPairs.push(`<b>${entry.user}</b>: ${assignments[entry.user]} - ${entry.date}`);
                                delete assignments[entry.user];
                            }
                         });
                         Object.keys(assignments).forEach(user => {
                            historyPairs.push(`<b>${user}</b>: ${assignments[user]} - дотепер`);
                         });
                         historyHtml = historyPairs.reverse().join('<br>'); // Most recent first
                    }
                    tg.showAlert(historyHtml, () => {});
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
         tg.showPopup({
            title: `Примітка до території ${territoryId}`,
            message: 'Введіть або змініть текст примітки:',
            buttons: [{id: 'save', type: 'default', text: 'Зберегти'}, {type: 'cancel'}],
            text: currentNote
        }, (btnId, text) => {
            if (btnId === 'save') {
                const payload = { action: 'updateTerritoryNote', userId: userId, territoryId: territoryId, note: text || '' };
                postToServer(payload, "Зберігаю примітку...", "Не вдалося зберегти примітку.");
            }
        });
    }

    // --- ДОПОМІЖНІ ФУНКЦІЇ (API, УТИЛІТИ) ---

    function postToServer(payload, loadingMsg, errorMsg) {
        tg.MainButton.setText(loadingMsg).show();
        fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        })
        .then(response => response.json())
        .then(result => {
            tg.MainButton.hide();
            if (result.ok) {
                tg.showAlert(result.message || "Успішно виконано!");
                fetchAllData(); // Оновлюємо всі дані
            } else {
                tg.showAlert(result.error || errorMsg);
            }
        })
        .catch(error => {
            tg.MainButton.hide();
            tg.showAlert('Критична помилка. Не вдалося виконати запит.');
        });
    }

    function returnTerritory(territoryId, buttonElement) {
        tg.MainButton.setText("Надсилаю запит...").show();
        fetch(`${SCRIPT_URL}?action=returnTerritory&territoryId=${territoryId}&userId=${userId}`)
            .then(response => response.json())
            .then(result => {
                tg.MainButton.hide();
                if (result.ok) {
                    tg.showAlert(result.message);
                    buttonElement.textContent = 'Очікує...';
                    buttonElement.disabled = true;
                } else {
                    tg.showAlert(result.message || 'Сталася невідома помилка.');
                }
            })
            .catch(error => {
                tg.MainButton.hide();
                tg.showAlert('Сталася критична помилка. Спробуйте пізніше.');
            });
    }

    function requestTerritory(territoryId, buttonElement) {
        tg.MainButton.setText("Надсилаю запит...").show();
        fetch(`${SCRIPT_URL}?action=requestTerritory&territoryId=${territoryId}&userId=${userId}`)
            .then(response => response.json())
            .then(result => {
                tg.MainButton.hide();
                if (result.ok) {
                    tg.showAlert(result.message);
                    const territoryItem = buttonElement.closest('.territory-item');
                    if (territoryItem) {
                        territoryItem.style.opacity = '0';
                        setTimeout(() => territoryItem.remove(), 300);
                    }
                } else {
                    tg.showAlert(result.message || 'Сталася невідома помилка.');
                }
            })
            .catch(error => {
                tg.MainButton.hide();
                tg.showAlert('Сталася критична помилка. Спробуйте пізніше.');
            });
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

    // --- МОДАЛЬНІ ВІКНА ---

    function handlePhotoClick(photoElement) {
        fullImage.src = photoElement.src;
        imageModal.dataset.photoId = photoElement.dataset.photoId;
        imageModal.dataset.caption = photoElement.dataset.caption;
        imageModal.classList.add('active');
    }
    closeModalBtn.addEventListener('click', () => imageModal.classList.remove('active'));
    imageModal.addEventListener('click', (e) => {
        if (e.target === imageModal || e.target.classList.contains('modal-image-container')) {
             imageModal.classList.remove('active');
        }
    });
    modalDownloadBtn.addEventListener('click', () => {
        const photoId = imageModal.dataset.photoId;
        const caption = imageModal.dataset.caption;
        if (!photoId || !caption) { tg.showAlert('Не вдалося отримати дані для надсилання.'); return; }
        
        tg.showAlert("Картка території з'явиться у вікні чату через декілька секунд");
        imageModal.classList.remove('active');
        postToServer({ action: 'sendPhotoToUser', userId: userId, photoId: photoId, caption: caption },
                     "Надсилаю фото...", "Не вдалося надіслати фото.");
    });

    function showGeneralModal(title, bodyHtml) {
        generalModalTitle.innerHTML = title;
        generalModalBody.innerHTML = bodyHtml;
        generalModal.style.display = 'flex';
    }
    function hideGeneralModal() {
        generalModal.style.display = 'none';
        generalModalTitle.innerHTML = '';
        generalModalBody.innerHTML = '';
    }
    generalModalCloseBtn.addEventListener('click', hideGeneralModal);
    generalModal.addEventListener('click', e => {
        if(e.target === generalModal) hideGeneralModal();
    });
    
    // --- ІНІЦІАЛІЗАЦІЯ ---
    fetchAllData();
});