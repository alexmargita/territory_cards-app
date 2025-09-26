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
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyFlBN5_L1dr0fncI39EZuMoxnBqtW03g1--BkU9IosROoSxgqqRlTFFFrdp7GZN22M/exec";
const ADMIN_CHAT_ID = "511782813"; // <-- Додаємо ADMIN_CHAT_ID тут

document.addEventListener('DOMContentLoaded', function() {
    const tg = window.Telegram.WebApp;
    tg.expand();

    const loader = document.getElementById('loader');
    const myTerritoryList = document.getElementById('my-territory-list');
    const freeTerritoryList = document.getElementById('territory-list');
    const generalMapsList = document.getElementById('general-maps-list');
    const adminTerritoryList = document.getElementById('admin-territory-list');
    const freeTerritoriesTitle = document.getElementById('free-territories-title');
    const filtersContainer = document.getElementById('filters-container');
    const adminFiltersContainer = document.getElementById('admin-filters-container');
    const imageModal = document.getElementById('image-modal');
    const fullImage = document.getElementById('full-image');
    const closeModalBtn = document.querySelector('.modal-close-btn');
    const modalDownloadBtn = document.getElementById('modal-download-btn');
    const adminModal = document.getElementById('admin-modal');
    const adminModalTitle = document.getElementById('admin-modal-title');
    const adminModalContent = document.getElementById('admin-modal-content');

    let allTerritories = [];
    let allUsers = [];
    const userId = tg.initDataUnsafe.user.id;
    const isAdmin = String(userId) === ADMIN_CHAT_ID; // Перевірка адміністратора

    // Показуємо адмін-вкладку, якщо користувач - адмін
    if (isAdmin) {
        document.querySelector('[data-tab="admin-all-territories"]').classList.remove('hidden');
    }

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

            if (targetTabId === 'my-territories') {
                fetchMyTerritories();
            } else if (targetTabId === 'select-territory') {
                fetchFreeTerritories();
            } else if (targetTabId === 'admin-all-territories') {
                fetchAllTerritoriesForAdmin();
            }
        });
    });

    adminFiltersContainer.addEventListener('click', (e) => {
        const target = e.target;
        if (target.classList.contains('admin-filter-btn')) {
            adminFiltersContainer.querySelector('.active')?.classList.remove('active');
            target.classList.add('active');
            displayAdminTerritories(target.dataset.adminFilter);
        }
    });

    function fetchAllTerritoriesForAdmin() {
        adminTerritoryList.innerHTML = `<div class="loader" style="font-size: 16px;">Оновлення...</div>`;
        fetch(SCRIPT_URL)
            .then(res => res.json())
            .then(allData => {
                if (allData.ok) {
                    allTerritories = allData.territories;
                    displayAdminTerritories('all');
                } else {
                    adminTerritoryList.innerHTML = '<p>Не вдалося оновити дані.</p>';
                }
            })
            .catch(error => {
                console.error('Fetch error:', error);
                adminTerritoryList.innerHTML = '<p>Помилка мережі. Спробуйте пізніше.</p>';
            });
    }

    function fetchMyTerritories() {
        myTerritoryList.innerHTML = `<div class="loader" style="font-size: 16px;">Оновлення...</div>`;
        fetch(`${SCRIPT_URL}?action=getMyTerritories&userId=${userId}`)
            .then(res => res.json())
            .then(myData => {
                if (myData.ok) {
                    displayMyTerritories(myData.territories);
                } else {
                    myTerritoryList.innerHTML = '<p>Не вдалося оновити дані.</p>';
                }
            })
            .catch(error => {
                console.error('Fetch error:', error);
                myTerritoryList.innerHTML = '<p>Помилка мережі. Спробуйте пізніше.</p>';
            });
    }

    function fetchFreeTerritories() {
        freeTerritoryList.innerHTML = `<div class="loader" style="font-size: 16px;">Оновлення...</div>`;
        fetch(SCRIPT_URL)
            .then(res => res.json())
            .then(allData => {
                if (allData.ok) {
                    allTerritories = allData.territories;
                    const activeFilter = document.querySelector('.filter-btn.active');
                    if (activeFilter) {
                        displayFreeTerritories(activeFilter.dataset.filter);
                    } else if (allData.filters && allData.filters.length > 0) {
                        displayFreeTerritories(allData.filters[0]);
                    }
                } else {
                    freeTerritoryList.innerHTML = '<p>Не вдалося оновити дані.</p>';
                }
            })
            .catch(error => {
                console.error('Fetch error:', error);
                freeTerritoryList.innerHTML = '<p>Помилка мережі. Спробуйте пізніше.</p>';
            });
    }

    function createPhotoBlock(territory) {
        if (!territory.picture_id) { return `<div class="placeholder-photo">Немає фото</div>`; }
        const imageUrl = GITHUB_BASE_URL + encodeURIComponent(territory.picture_id);
        const caption = `📍 ${territory.id ? territory.id + '.' : ''} ${territory.name}`;
        return `<img class="territory-photo" 
                     src="${imageUrl}" 
                     data-photo-id="${territory.picture_id}"
                     data-caption="${caption}"
                     alt="Фото"
                     loading="lazy">`;
    }

    function createNoteIcon(territory) {
        if (territory.info && territory.info.trim() !== '') {
            const noteText = territory.info.replace(/"/g, '&quot;');
            return `<span class="note-icon" data-note="${noteText}">i</span>`;
        }
        return '';
    }

    function calculateDaysRemaining(assignDateStr) {
        if (assignDateStr instanceof Date) {
            assignDateStr = assignDateStr.toLocaleDateString('uk-UA');
        }
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

    function displayMyTerritories(territories) {
        myTerritoryList.innerHTML = '';
        if (territories.length === 0) { myTerritoryList.innerHTML = '<p>На даний час ви не маєте жодної території.</p>'; return; }
        territories.forEach(t => {
            const item = document.createElement('div');
            item.className = 'territory-item';
            item.dataset.territoryId = t.id;
            const remainingDays = calculateDaysRemaining(t.date_assigned);
            let daysBlock = '';
            if (remainingDays !== null) {
                const endingSoonClass = remainingDays <= 30 ? 'ending-soon' : '';
                const progressPercent = Math.min((remainingDays / 120) * 100, 100);
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
            item.dataset.territoryId = t.id;

            const isPriority = isPriorityTerritory(t.date_completed);

            if (isPriority) {
                item.classList.add('priority');
            }

            const territoryNameForButton = t.name.replace(/"/g, '&quot;');
            const buttonHtml = `<button class="btn-book" data-id="${t.id}" data-name="${territoryNameForButton}">✅ Обрати</button>`;

            const noteHtml = isPriority ? `<div class="priority-note">Потребує опрацювання</div>` : '';
            const actionAreaHtml = `<div class="action-area">${buttonHtml}${noteHtml}</div>`;

            item.innerHTML = `<div class="territory-title"><span>📍 ${t.id}. ${t.name}</span> ${createNoteIcon(t)}</div><div class="territory-content">${createPhotoBlock(t)}${actionAreaHtml}</div>`;

            freeTerritoryList.appendChild(item);
        });
    }

    function displayAdminTerritories(filter) {
        adminTerritoryList.innerHTML = '';
        const filtered = allTerritories.filter(t => t.category === 'territory' && (
            filter === 'all' ||
            (filter === 'free' && t.status === 'вільна') ||
            (filter === 'assigned' && t.status === 'зайнята') ||
            (filter === 'returned' && t.status === 'повернена') ||
            (filter === 'priority' && isPriorityTerritory(t.date_completed))
        ));

        if (filtered.length === 0) {
            adminTerritoryList.innerHTML = '<p>Немає територій, що відповідають цьому фільтру.</p>';
            return;
        }

        filtered.forEach(t => {
            const item = document.createElement('div');
            item.className = `territory-item admin-card ${getStatusClass(t.status)}`;
            item.dataset.territoryId = t.id;
            item.dataset.status = t.status;
            item.dataset.userId = t.assignee_id;
            item.dataset.userName = t.assignee_name;

            const isPriority = isPriorityTerritory(t.date_completed);
            if (isPriority) {
                item.classList.add('priority');
            }

            let assignedInfo = '';
            if (t.status === 'зайнята' || t.status === 'в очікуванні') {
                assignedInfo = `<div class="admin-card-info">Зайнята: <strong>${t.assignee_name || 'Невідомо'}</strong></div>`;
            } else if (t.status === 'повернена') {
                assignedInfo = `<div class="admin-card-info">Повернена: <strong>${t.date_completed}</strong></div>`;
            }

            const buttons = createAdminButtons(t);

            item.innerHTML = `
                <div class="territory-title">
                    <span>📍 ${t.id}. ${t.name}</span> ${createNoteIcon(t)}
                </div>
                <div class="territory-content">
                    ${createPhotoBlock(t)}
                    <div class="action-area">
                        ${assignedInfo}
                        <div class="admin-card-buttons">
                            ${buttons}
                        </div>
                    </div>
                </div>
            `;
            adminTerritoryList.appendChild(item);
        });
    }
    
    function getStatusClass(status) {
        switch (status) {
            case 'вільна':
                return 'free';
            case 'зайнята':
                return 'assigned';
            case 'повернена':
                return 'returned';
            case 'в очікуванні':
                return 'in-waiting';
            default:
                return '';
        }
    }

    function createAdminButtons(t) {
        let buttonsHtml = '';
        if (t.status === 'зайнята' || t.status === 'в очікуванні') {
            buttonsHtml += `<button class="admin-btn btn-return" style="background-color: #dc3545;" data-id="${t.id}">Здати</button>`;
            buttonsHtml += `<button class="admin-btn btn-reassign" style="background-color: #ffc107;" data-id="${t.id}">Продовжити</button>`;
        } else {
            buttonsHtml += `<button class="admin-btn btn-assign" style="background-color: #28a745;" data-id="${t.id}">Призначити</button>`;
        }
        buttonsHtml += `<button class="admin-btn btn-history" style="background-color: #17a2b8;" data-id="${t.id}">Історія</button>`;
        buttonsHtml += `<button class="admin-btn btn-note" style="background-color: #6c757d;" data-id="${t.id}">Примітка</button>`;
        return buttonsHtml;
    }

    function displayGeneralMaps() {
        generalMapsList.innerHTML = '';
        const maps = allTerritories.filter(t => t.category === 'map');
        if (maps.length === 0) { generalMapsList.innerHTML = '<p>Загальні карти відсутні.</p>'; return; }
        maps.forEach(t => {
            const item = document.createElement('div');
            item.className = 'territory-item';
            item.dataset.territoryId = t.id;
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

    document.body.addEventListener('click', function(event) {
        const target = event.target;
        if (target.classList.contains('note-icon')) {
            const noteText = target.dataset.note;
            if (noteText) { tg.showAlert(noteText); }
        }
        if (target.classList.contains('territory-photo')) handlePhotoClick(target);
        if (target.classList.contains('btn-return')) {
            const territoryId = target.dataset.id;
            tg.showConfirm(`Ви впевнені, що хочете надіслати запит на повернення території ${territoryId}?`, (isConfirmed) => {
                if (isConfirmed) returnTerritory(territoryId, target);
            });
        }
        if (target.classList.contains('btn-book')) {
            const territoryId = target.dataset.id;
            const territoryName = target.dataset.name;
            tg.showConfirm(`Ви впевнені, що хочете обрати територію "${territoryId}. ${territoryName}"?`, (isConfirmed) => {
                if (isConfirmed) {
                    requestTerritory(territoryId, target);
                }
            });
        }
        if (target.classList.contains('filter-btn')) {
            filtersContainer.querySelector('.active')?.classList.remove('active');
            target.classList.add('active');
            displayFreeTerritories(target.dataset.filter);
        }
        // Admin-specific handlers
        if (isAdmin) {
            if (target.classList.contains('btn-assign')) {
                const territoryId = target.dataset.id;
                showAssignUserModal(territoryId);
            }
            if (target.classList.contains('btn-reassign')) {
                 const territoryId = target.dataset.id;
                 const userName = target.closest('.territory-item').dataset.userName;
                 tg.showConfirm(`Ви впевнені, що хочете продовжити опрацювання території ${territoryId} для ${userName}?`, (isConfirmed) => {
                     if (isConfirmed) handleReassign(territoryId);
                 });
            }
            if (target.classList.contains('btn-history')) {
                const territoryId = target.dataset.id;
                showHistoryModal(territoryId);
            }
            if (target.classList.contains('btn-note')) {
                const territoryId = target.dataset.id;
                showNoteModal(territoryId);
            }
        }
    });

    function showAssignUserModal(territoryId) {
        tg.MainButton.setText("Завантажую список...").show().enable();
        fetch(`${SCRIPT_URL}?action=getUsers`)
            .then(res => res.json())
            .then(data => {
                tg.MainButton.hide();
                if (data.ok) {
                    const userListHtml = data.users.sort((a, b) => a.name.localeCompare(b.name)).map(user => `
                        <li class="user-item" data-user-id="${user.id}" data-user-name="${user.name}">
                            ${user.name}
                        </li>
                    `).join('');
                    adminModalTitle.textContent = `Призначити територію ${territoryId}`;
                    adminModalContent.innerHTML = `<ul class="user-list">${userListHtml}</ul>`;
                    adminModal.classList.add('active');
                    adminModalContent.querySelectorAll('.user-item').forEach(item => {
                        item.addEventListener('click', () => {
                            const userIdToAssign = item.dataset.userId;
                            const userNameToAssign = item.dataset.userName;
                            tg.showConfirm(`Призначити територію ${territoryId} користувачу ${userNameToAssign}?`, (isConfirmed) => {
                                if (isConfirmed) {
                                    assignTerritoryToUser(territoryId, userIdToAssign);
                                    adminModal.classList.remove('active');
                                }
                            });
                        });
                    });
                } else {
                    tg.showAlert('Не вдалося завантажити список користувачів.');
                }
            })
            .catch(error => {
                tg.MainButton.hide();
                tg.showAlert('Помилка завантаження користувачів.');
            });
    }

    function assignTerritoryToUser(territoryId, userIdToAssign) {
        tg.MainButton.setText("Призначаю...").show().enable();
        const payload = {
            action: 'assignTerritoryFromAdmin',
            territoryId: territoryId,
            userId: userIdToAssign,
            adminId: userId
        };
        fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        })
        .then(response => response.json())
        .then(result => {
            tg.MainButton.hide();
            if (result.ok) {
                tg.showAlert(`Територію ${territoryId} успішно призначено.`);
                fetchAllTerritoriesForAdmin(); // Оновлюємо список
            } else {
                tg.showAlert(result.error || 'Не вдалося призначити територію.');
            }
        })
        .catch(error => {
            tg.MainButton.hide();
            tg.showAlert('Помилка: не вдалося виконати запит.');
        });
    }
    
    function handleReassign(territoryId) {
        tg.MainButton.setText("Продовжую...").show().enable();
        const payload = {
            action: 'reassignTerritory',
            territoryId: territoryId,
            adminId: userId
        };
        fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        })
        .then(response => response.json())
        .then(result => {
            tg.MainButton.hide();
            if (result.ok) {
                tg.showAlert(`Територію ${territoryId} успішно продовжено.`);
                fetchAllTerritoriesForAdmin();
            } else {
                tg.showAlert(result.error || 'Не вдалося продовжити територію.');
            }
        })
        .catch(error => {
            tg.MainButton.hide();
            tg.showAlert('Помилка: не вдалося виконати запит.');
        });
    }

    function showHistoryModal(territoryId) {
        tg.MainButton.setText("Завантажую історію...").show().enable();
        fetch(`${SCRIPT_URL}?action=getTerritoryHistory&territoryId=${territoryId}`)
            .then(res => res.json())
            .then(data => {
                tg.MainButton.hide();
                if (data.ok) {
                    const historyHtml = data.history.map(item => `
                        <li class="history-item">
                            ${item.type === 'Assigned' ? 'Призначено' : 'Повернено'} для <strong>${item.user_name}</strong><br>
                            Дата: ${item.date} <br>
                            ${item.days ? `Днів: ${item.days}` : ''}
                        </li>
                    `).join('');
                    adminModalTitle.textContent = `Історія території ${territoryId}`;
                    adminModalContent.innerHTML = `<ul class="history-list">${historyHtml || '<p>Історія відсутня.</p>'}</ul>`;
                    adminModal.classList.add('active');
                } else {
                    tg.showAlert('Не вдалося завантажити історію.');
                }
            })
            .catch(error => {
                tg.MainButton.hide();
                tg.showAlert('Помилка завантаження історії.');
            });
    }
    
    function showNoteModal(territoryId) {
        const territory = allTerritories.find(t => String(t.id) === String(territoryId));
        if (!territory) { tg.showAlert('Територію не знайдено.'); return; }

        adminModalTitle.textContent = `Примітка для території ${territoryId}`;
        adminModalContent.innerHTML = `<textarea id="note-textarea">${territory.info || ''}</textarea><button id="save-note-btn" class="modal-btn" style="margin-top: 10px; width: 100%;">Зберегти</button>`;
        adminModal.classList.add('active');

        document.getElementById('save-note-btn').addEventListener('click', () => {
            const newNote = document.getElementById('note-textarea').value;
            saveNote(territoryId, newNote);
        });
    }

    function saveNote(territoryId, note) {
        tg.MainButton.setText("Зберігаю...").show().enable();
        const payload = {
            action: 'updateTerritoryNote',
            territoryId: territoryId,
            note: note,
            adminId: userId
        };
        fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        })
        .then(response => response.json())
        .then(result => {
            tg.MainButton.hide();
            if (result.ok) {
                tg.showAlert('Примітку успішно оновлено.');
                adminModal.classList.remove('active');
                fetchAllTerritoriesForAdmin(); // Оновлюємо список
            } else {
                tg.showAlert(result.error || 'Не вдалося оновити примітку.');
            }
        })
        .catch(error => {
            tg.MainButton.hide();
            tg.showAlert('Помилка: не вдалося виконати запит.');
        });
    }
    
    // Закриття адмін-модального вікна
    document.querySelector('#admin-modal .modal-close-btn').addEventListener('click', () => {
        adminModal.classList.remove('active');
    });

    function handlePhotoClick(photoElement) {
        fullImage.src = photoElement.src;
        imageModal.dataset.photoId = photoElement.dataset.photoId;
        imageModal.dataset.caption = photoElement.dataset.caption;
        imageModal.classList.add('active');
    }

    closeModalBtn.addEventListener('click', () => {
        imageModal.classList.remove('active');
        resetTransform();
    });
    imageModal.addEventListener('click', (e) => {
        if (e.target === imageModal || e.target.classList.contains('modal-image-container')) {
             imageModal.classList.remove('active');
             resetTransform();
        }
    });

    modalDownloadBtn.addEventListener('click', () => {
        const photoId = imageModal.dataset.photoId;
        const caption = imageModal.dataset.caption;
        if (!photoId || !caption) { tg.showAlert('Не вдалося отримати дані для надсилання.'); return; }

        tg.showAlert("Картка території з'явиться у вікні чату через декілька секунд");
        imageModal.classList.remove('active');
        resetTransform();

        const payload = {
            action: 'sendPhotoToUser',
            userId: userId,
            photoId: photoId,
            caption: caption
        };
        fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        })
        .then(response => response.json())
        .then(result => {
            if (!result.ok) {
                tg.showAlert(result.error || 'Сталася помилка під час надсилання фото.');
            }
        })
        .catch(error => {
            tg.showAlert('Критична помилка. Не вдалося виконати запит.');
        });
    });

    function returnTerritory(territoryId, buttonElement) {
        tg.MainButton.setText("Надсилаю запит...").show().enable();
        fetch(`${SCRIPT_URL}?action=returnTerritory&territoryId=${territoryId}&userId=${userId}`)
            .then(response => response.json())
            .then(result => {
                tg.MainButton.hide();
                if (result.ok) {
                    tg.showAlert(result.message);
                    buttonElement.textContent = 'Очікує...';
                    buttonElement.disabled = true;
                } else {
                    tg.showAlert(result.message || result.error || 'Сталася невідома помилка.');
                }
            })
            .catch(error => {
                tg.MainButton.hide();
                tg.showAlert('Сталася критична помилка. Спробуйте пізніше.');
            });
    }

    function requestTerritory(territoryId, buttonElement) {
        tg.MainButton.setText("Надсилаю запит...").show().enable();
        fetch(`${SCRIPT_URL}?action=requestTerritory&territoryId=${territoryId}&userId=${userId}`)
            .then(response => response.json())
            .then(result => {
                tg.MainButton.hide();
                if (result.ok) {
                    tg.showAlert(result.message);
                    const territoryItem = buttonElement.closest('.territory-item');
                    if (territoryItem) {
                        territoryItem.style.opacity = '0';
                        setTimeout(() => {
                            territoryItem.remove();
                        }, 300);
                    }
                } else {
                    tg.showAlert(result.message || result.error || 'Сталася невідома помилка.');
                }
            })
            .catch(error => {
                tg.MainButton.hide();
                tg.showAlert('Сталася критична помилка. Спробуйте пізніше.');
            });
    }

    function fetchAllData() {
        loader.style.display = 'block';
        myTerritoryList.innerHTML = '';
        freeTerritoryList.innerHTML = '';
        generalMapsList.innerHTML = '';

        const promises = [
            fetch(`${SCRIPT_URL}?action=getMyTerritories&userId=${userId}`).then(res => res.json()),
            fetch(SCRIPT_URL).then(res => res.json())
        ];
        
        // Якщо адмін, завантажуємо список користувачів
        if (isAdmin) {
            promises.push(fetch(`${SCRIPT_URL}?action=getUsers`).then(res => res.json()));
        }

        Promise.all(promises).then(([myData, allData, usersData]) => {
            loader.style.display = 'none';
            if (myData.ok) displayMyTerritories(myData.territories);

            if (allData.ok) {
                allTerritories = allData.territories;
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
            } else {
                 document.body.innerHTML = `<p>Помилка завантаження даних: ${allData.error}</p>`;
            }
            
            if (isAdmin && usersData && usersData.ok) {
                allUsers = usersData.users;
                // Автоматично завантажуємо адмін-вкладку, якщо вона активна початково
                if (document.querySelector('[data-tab="admin-all-territories"]').classList.contains('active')) {
                    fetchAllTerritoriesForAdmin();
                }
            }
        }).catch(error => {
            loader.style.display = 'none';
            console.error('Critical fetch error:', error);
            document.body.innerHTML = `<p>Критична помилка. Не вдалося завантажити дані.</p>`;
        });
    }

    let scale = 1;
    let isPanning = false;
    let startX = 0;
    let startY = 0;
    let translateX = 0;
    let translateY = 0;
    let initialPinchDistance = null;

    function updateTransform() {
        fullImage.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    }

    function resetTransform() {
        scale = 1;
        translateX = 0;
        translateY = 0;
        updateTransform();
    }

    imageModal.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const newScale = Math.max(1, Math.min(scale + delta, 5));

        if (newScale !== scale) {
            scale = newScale;
            if (scale === 1) {
                translateX = 0;
                translateY = 0;
            }
            updateTransform();
        }
    });

    imageModal.addEventListener('mousedown', (e) => {
        if (e.target !== fullImage || scale <= 1) return;
        e.preventDefault();
        isPanning = true;
        fullImage.classList.add('grabbing');
        startX = e.clientX - translateX;
        startY = e.clientY - translateY;
    });

    imageModal.addEventListener('mousemove', (e) => {
        if (!isPanning) return;
        e.preventDefault();
        translateX = e.clientX - startX;
        translateY = e.clientY - startY;
        updateTransform();
    });

    window.addEventListener('mouseup', () => {
        isPanning = false;
        fullImage.classList.remove('grabbing');
    });

    function getDistance(touches) {
        const [touch1, touch2] = touches;
        return Math.sqrt(
            Math.pow(touch2.clientX - touch1.clientX, 2) +
            Math.pow(touch2.clientY - touch1.clientY, 2)
        );
    }

    imageModal.addEventListener('touchstart', (e) => {
        if (e.target !== fullImage || e.touches.length > 2) return;

        if (e.touches.length === 1 && scale > 1) {
            isPanning = true;
            fullImage.classList.add('grabbing');
            startX = e.touches[0].clientX - translateX;
            startY = e.touches[0].clientY - translateY;
        } else if (e.touches.length === 2) {
            isPanning = false;
            initialPinchDistance = getDistance(e.touches);
        }
    });

    imageModal.addEventListener('touchmove', (e) => {
        if (e.target !== fullImage) return;
        e.preventDefault();

        if (isPanning && e.touches.length === 1) {
            translateX = e.touches[0].clientX - startX;
            translateY = e.touches[0].clientY - startY;
            updateTransform();
        } else if (e.touches.length === 2 && initialPinchDistance) {
            const newDistance = getDistance(e.touches);
            const scaleFactor = newDistance / initialPinchDistance;

            const newScale = Math.max(1, Math.min(scale * scaleFactor, 5));
            if (newScale !== scale) {
                scale = newScale;
                if (scale === 1) {
                    translateX = 0;
                    translateY = 0;
                }
                updateTransform();
            }
            initialPinchDistance = newDistance;
        }
    });

    imageModal.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) initialPinchDistance = null;
        if (e.touches.length < 1) {
            isPanning = false;
            fullImage.classList.remove('grabbing');
        }
    });

    fetchAllData();
});