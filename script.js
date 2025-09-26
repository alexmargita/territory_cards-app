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
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwz-aANuYB3ZmjdtamMfmoqXNUvtdwNDp3BgykKu-JRh4N-wv1MxPv4E_fSjK2YFk0/exec";

// Нова змінна для зберігання всіх територій адміністратора
let allTerritoriesData = [];
let allUsersData = [];
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', function() {
    const tg = window.Telegram.WebApp;
    tg.expand();

    const loader = document.getElementById('loader');
    const myTerritoryList = document.getElementById('my-territory-list');
    const freeTerritoryList = document.getElementById('territory-list');
    const generalMapsList = document.getElementById('general-maps-list');
    const freeTerritoriesTitle = document.getElementById('free-territories-title');
    const filtersContainer = document.getElementById('filters-container');
    const imageModal = document.getElementById('image-modal');
    const fullImage = document.getElementById('full-image');
    const modalCloseBtn = document.querySelector('.modal-close-btn');
    const modalDownloadBtn = document.getElementById('modal-download-btn');
    const modalInfoBtn = document.getElementById('modal-info-btn');
    const modalReturnBtn = document.getElementById('modal-return-btn');
    
    // Нові елементи для адміністратора
    const adminTabButton = document.querySelector('.admin-tab-button');
    const allTerritoryList = document.getElementById('admin-territory-list');
    const adminFilterButtons = document.querySelectorAll('.admin-filters .filter-button');
    const adminSearchInput = document.getElementById('admin-search-input');
    const adminSearchIcon = document.getElementById('admin-search-icon');
    
    // Нові модальні вікна
    const assignModal = document.getElementById('assign-modal');
    const noteModal = document.getElementById('note-modal');
    const historyModal = document.getElementById('history-modal');
    const noteTextarea = document.getElementById('note-textarea');
    const noteSaveBtn = document.getElementById('note-save-btn');
    
    let currentTerritoryId = null;
    let scale = 1;
    let translateX = 0;
    let translateY = 0;
    let startX = 0;
    let startY = 0;
    let isPanning = false;
    let initialPinchDistance = null;

    // Перевірка, чи є користувач адміністратором
    checkAdminStatus();
    
    function showLoader() { loader.style.display = 'flex'; }
    function hideLoader() { loader.style.display = 'none'; }

    async function fetchData(action, body = {}) {
        const userId = tg.initDataUnsafe.user.id;
        const data = { ...body, userId, action };
        
        try {
            const response = await fetch(SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify(data),
                headers: { 'Content-Type': 'application/json' }
            });
            return response.json();
        } catch (error) {
            console.error('Fetch error:', error);
            tg.showPopup({
                title: 'Помилка',
                message: 'Виникла помилка під час завантаження даних.',
                buttons: [{ id: 'ok', type: 'ok' }]
            });
        }
    }

    async function checkAdminStatus() {
        showLoader();
        try {
            const userId = tg.initDataUnsafe.user.id;
            const response = await fetch(`${SCRIPT_URL}?action=getIsAdmin&userId=${userId}`);
            const data = await response.json();
            if (data.isAdmin) {
                adminTabButton.style.display = 'block';
                await fetchAllTerritories();
            }
        } catch (error) {
            console.error('Failed to check admin status:', error);
        } finally {
            hideLoader();
        }
    }

    async function fetchAllTerritories() {
        showLoader();
        const data = await fetchData('getAllTerritories');
        if (data) {
            allTerritoriesData = data;
            filterAndRenderAllTerritories();
        }
        hideLoader();
    }
    
    function filterAndRenderAllTerritories() {
        let filteredTerritories = allTerritoriesData;
        
        // Фільтрація за статусом
        if (currentFilter !== 'all' && currentFilter !== 'рідко опрацьовані') {
            filteredTerritories = filteredTerritories.filter(t => t.status === currentFilter);
        } else if (currentFilter === 'рідко опрацьовані') {
            filteredTerritories = filteredTerritories.filter(t => t.is_rarely_processed);
        }
        
        // Пошук за текстом
        const searchText = adminSearchInput.value.toLowerCase();
        if (searchText) {
            filteredTerritories = filteredTerritories.filter(t => 
                t.id.toString().toLowerCase().includes(searchText) || 
                t.name.toLowerCase().includes(searchText)
            );
        }

        renderTerritories(filteredTerritories, allTerritoryList, 'all-territories');
    }

    // Решта функцій... (без змін, крім викликів renderTerritories)

    // Функція для візуалізації карток (оновлена для адміністратора)
    function renderTerritories(territories, container, tabName) {
        container.innerHTML = '';
        if (territories.length === 0) {
            container.innerHTML = '<p>Немає територій для відображення.</p>';
            return;
        }

        territories.forEach(t => {
            const territoryItem = document.createElement('div');
            territoryItem.className = 'territory-item';
            territoryItem.dataset.id = t.id;
            
            // Додавання класів для кольору фону
            if (tabName === 'all-territories') {
                territoryItem.classList.add(`status-${t.status}`);
            }

            // Додавання класу для рідко опрацьованих
            if (t.is_rarely_processed) {
                territoryItem.classList.add('priority');
            }

            const imageContainer = document.createElement('div');
            imageContainer.className = 'territory-image-container';
            const image = document.createElement('img');
            image.src = `${GITHUB_BASE_URL}${t.category}/${t.id}.jpg`;
            image.className = 'territory-image';
            image.alt = `Карта ${t.id}`;
            image.addEventListener('click', () => showImageModal(t));
            imageContainer.appendChild(image);

            const content = document.createElement('div');
            content.className = 'territory-content';
            const title = document.createElement('h3');
            title.className = 'territory-title';
            title.textContent = t.name;
            const meta = document.createElement('p');
            meta.className = 'territory-meta';
            meta.textContent = t.meta;
            const idSpan = document.createElement('span');
            idSpan.className = 'territory-id';
            idSpan.textContent = `ID: ${t.id}`;

            const infoText = document.createElement('p');
            infoText.className = 'info-text';
            infoText.textContent = t.info || '';

            content.appendChild(title);
            content.appendChild(meta);
            content.appendChild(idSpan);
            content.appendChild(infoText);
            
            // Додавання інформації про користувача для адміністратора
            if (tabName === 'all-territories') {
                if (t.status === 'зайнята') {
                    const adminInfo = document.createElement('p');
                    adminInfo.className = 'admin-info';
                    const assignedDate = new Date(t.date_assigned);
                    adminInfo.innerHTML = `**Власник:** <span>${t.user_full_name}</span><br>**Призначено:** ${assignedDate.toLocaleDateString()}`;
                    content.appendChild(adminInfo);
                }
            }

            const actions = document.createElement('div');
            actions.className = 'card-actions';

            if (tabName === 'my-territories') {
                const returnBtn = document.createElement('button');
                returnBtn.className = 'button primary';
                returnBtn.textContent = 'Здати';
                returnBtn.addEventListener('click', () => returnTerritoryHandler(t));
                actions.appendChild(returnBtn);
                const infoBtn = document.createElement('button');
                infoBtn.className = 'button secondary';
                infoBtn.textContent = 'Примітка';
                infoBtn.addEventListener('click', () => showNoteModal(t.id, t.info));
                actions.appendChild(infoBtn);
            } else if (tabName === 'select-territory') {
                const assignBtn = document.createElement('button');
                assignBtn.className = 'button primary';
                assignBtn.textContent = 'Обрати';
                assignBtn.addEventListener('click', () => assignTerritoryHandler(t));
                actions.appendChild(assignBtn);
            } else if (tabName === 'all-territories') {
                const assignBtn = document.createElement('button');
                assignBtn.className = 'button primary';
                assignBtn.textContent = 'Призначити';
                assignBtn.addEventListener('click', () => showAssignModal(t.id));
                actions.appendChild(assignBtn);
                
                if (t.status === 'зайнята') {
                    const returnBtn = document.createElement('button');
                    returnBtn.className = 'button secondary';
                    returnBtn.textContent = 'Здати';
                    returnBtn.addEventListener('click', () => returnTerritoryAdminHandler(t.id));
                    actions.appendChild(returnBtn);
                    
                    const extendBtn = document.createElement('button');
                    extendBtn.className = 'button secondary';
                    extendBtn.textContent = 'Продовжити';
                    extendBtn.addEventListener('click', () => extendTerritoryAdminHandler(t.id));
                    actions.appendChild(extendBtn);
                }
                
                const historyBtn = document.createElement('button');
                historyBtn.className = 'button secondary';
                historyBtn.textContent = 'Історія';
                historyBtn.addEventListener('click', () => showHistoryModal(t.id));
                actions.appendChild(historyBtn);
                
                const noteBtn = document.createElement('button');
                noteBtn.className = 'button secondary';
                noteBtn.textContent = 'Примітка';
                noteBtn.addEventListener('click', () => showNoteModal(t.id, t.info));
                actions.appendChild(noteBtn);
            }

            territoryItem.appendChild(imageContainer);
            territoryItem.appendChild(content);
            if (actions.children.length > 0) {
                territoryItem.appendChild(actions);
            }
            container.appendChild(territoryItem);
        });
    }

    // Обробники для нових адміністративних функцій
    
    // Модальне вікно для призначення
    async function showAssignModal(territoryId) {
        currentTerritoryId = territoryId;
        const userListContainer = document.getElementById('user-list-container');
        userListContainer.innerHTML = '';
        
        showLoader();
        const users = await fetchData('getUsers');
        allUsersData = users; // Зберігаємо список користувачів
        hideLoader();
        
        if (users && users.length > 0) {
            users.forEach(user => {
                const userBtn = document.createElement('button');
                userBtn.className = 'user-list-button';
                userBtn.textContent = user.fullName;
                userBtn.addEventListener('click', () => {
                    assignTerritoryAdminHandler(territoryId, user.id);
                    assignModal.style.display = 'none';
                });
                userListContainer.appendChild(userBtn);
            });
        } else {
            userListContainer.innerHTML = '<p>Немає зареєстрованих користувачів.</p>';
        }
        
        assignModal.style.display = 'block';
    }
    
    async function assignTerritoryAdminHandler(territoryId, newUserId) {
        showLoader();
        const response = await fetchData('assignTerritoryAdmin', { territoryId, newUserId });
        if (response.status === 'success') {
            tg.showAlert('Територію успішно призначено!');
            await fetchAllTerritories();
        } else {
            tg.showAlert('Помилка: ' + (response.message || 'Не вдалося призначити територію.'));
        }
        hideLoader();
    }
    
    async function returnTerritoryAdminHandler(territoryId) {
        tg.showConfirm('Ви впевнені, що хочете повернути цю територію?', async (isConfirmed) => {
            if (isConfirmed) {
                showLoader();
                const response = await fetchData('returnTerritoryAdmin', { territoryId });
                if (response.status === 'success') {
                    tg.showAlert('Територію успішно повернуто!');
                    await fetchAllTerritories();
                } else {
                    tg.showAlert('Помилка: ' + (response.message || 'Не вдалося повернути територію.'));
                }
                hideLoader();
            }
        });
    }

    async function extendTerritoryAdminHandler(territoryId) {
        tg.showConfirm('Ви впевнені, що хочете продовжити опрацювання цієї території?', async (isConfirmed) => {
            if (isConfirmed) {
                showLoader();
                const response = await fetchData('extendTerritoryAdmin', { territoryId });
                if (response.status === 'success') {
                    tg.showAlert('Термін опрацювання продовжено!');
                    await fetchAllTerritories();
                } else {
                    tg.showAlert('Помилка: ' + (response.message || 'Не вдалося продовжити термін.'));
                }
                hideLoader();
            }
        });
    }

    async function showHistoryModal(territoryId) {
        currentTerritoryId = territoryId;
        const historyList = document.getElementById('history-list');
        historyList.innerHTML = '';
        
        showLoader();
        const history = await fetchData('getTerritoryHistory', { territoryId });
        hideLoader();

        if (history && history.length > 0) {
            history.forEach(item => {
                const historyItem = document.createElement('div');
                historyItem.className = 'history-item';
                const startDate = new Date(item.start_date).toLocaleDateString('uk-UA');
                const endDate = item.end_date ? new Date(item.end_date).toLocaleDateString('uk-UA') : 'зараз';
                historyItem.innerHTML = `<p><b>${item.user_full_name}</b></p><p>${startDate} - ${endDate}</p>`;
                historyList.appendChild(historyItem);
            });
        } else {
            historyList.innerHTML = '<p>Історія для цієї території відсутня.</p>';
        }
        
        historyModal.style.display = 'block';
    }

    function showNoteModal(territoryId, currentNote) {
        currentTerritoryId = territoryId;
        noteTextarea.value = currentNote || '';
        noteModal.style.display = 'block';
    }
    
    noteSaveBtn.addEventListener('click', async () => {
        const newNote = noteTextarea.value;
        if (currentTerritoryId) {
            showLoader();
            const response = await fetchData('updateTerritoryNote', { territoryId: currentTerritoryId, newNote });
            if (response.status === 'success') {
                tg.showAlert('Примітку успішно оновлено!');
                // Оновлення даних на стороні клієнта
                const territoryIndex = allTerritoriesData.findIndex(t => t.id.toString() === currentTerritoryId.toString());
                if (territoryIndex !== -1) {
                    allTerritoriesData[territoryIndex].info = newNote;
                }
                filterAndRenderAllTerritories();
            } else {
                tg.showAlert('Помилка: ' + (response.message || 'Не вдалося оновити примітку.'));
            }
            hideLoader();
            noteModal.style.display = 'none';
        }
    });

    // Обробник для кнопок фільтрів адміністратора
    adminFilterButtons.forEach(button => {
        button.addEventListener('click', () => {
            adminFilterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            currentFilter = button.dataset.status;
            filterAndRenderAllTerritories();
        });
    });

    // Обробник для іконки пошуку
    adminSearchIcon.addEventListener('click', () => {
        adminSearchInput.style.display = adminSearchInput.style.display === 'block' ? 'none' : 'block';
        if (adminSearchInput.style.display === 'block') {
            adminSearchInput.focus();
        } else {
            adminSearchInput.value = '';
            filterAndRenderAllTerritories();
        }
    });
    
    adminSearchInput.addEventListener('input', () => {
        filterAndRenderAllTerritories();
    });

    // Закриття модальних вікон
    document.querySelectorAll('.modal .modal-close-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal').style.display = 'none';
        });
    });
    
    // Оновлена логіка перемикання вкладок
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.dataset.tab;
            
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            tabContents.forEach(content => {
                if (content.id === targetTab) {
                    content.classList.add('active');
                    content.style.display = 'block';
                } else {
                    content.classList.remove('active');
                    content.style.display = 'none';
                }
            });
            
            if (targetTab === 'my-territories') fetchMyTerritories();
            if (targetTab === 'select-territory') fetchFreeTerritories();
            if (targetTab === 'general-maps') fetchGeneralMaps();
            if (targetTab === 'all-territories') fetchAllTerritories();
        });
    });

    // Решта функцій... (без змін)
    function fetchMyTerritories() {
        showLoader();
        const userId = tg.initDataUnsafe.user.id;
        fetchData('getTerritoriesForUser', { userId })
            .then(data => {
                renderTerritories(data, myTerritoryList, 'my-territories');
                hideLoader();
            });
    }

    function fetchFreeTerritories() {
        showLoader();
        freeTerritoriesTitle.style.display = 'none';
        const userId = tg.initDataUnsafe.user.id;
        fetchData('getTerritoriesByCategory', { category: 'settlement' })
            .then(categories => {
                renderFilters(categories);
                hideLoader();
            });
    }

    function fetchGeneralMaps() {
        showLoader();
        fetchData('getGeneralMaps')
            .then(data => {
                renderTerritories(data, generalMapsList, 'general-maps');
                hideLoader();
            });
    }

    function renderFilters(categories) {
        filtersContainer.innerHTML = '';
        categories.forEach(cat => {
            const button = document.createElement('button');
            button.className = 'filter-button';
            button.textContent = cat.name;
            button.dataset.category = cat.name;
            button.addEventListener('click', () => {
                document.querySelectorAll('.filters .filter-button').forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                showLoader();
                fetchData('getFreeTerritories', { territoryCategory: cat.name })
                    .then(data => {
                        freeTerritoriesTitle.style.display = 'block';
                        renderTerritories(data, freeTerritoryList, 'select-territory');
                        hideLoader();
                    });
            });
            filtersContainer.appendChild(button);
        });
    }

    async function assignTerritoryHandler(territory) {
        showLoader();
        const userId = tg.initDataUnsafe.user.id;
        const userFullName = `${tg.initDataUnsafe.user.first_name} ${tg.initDataUnsafe.user.last_name || ''}`.trim();
        const userName = tg.initDataUnsafe.user.username;
        const response = await fetchData('assignTerritory', {
            territoryId: territory.id,
            userId,
            userName,
            userFullName,
            territoryName: territory.name
        });
        if (response.status === 'success') {
            tg.showAlert('Територію успішно закріплено за вами!');
            fetchFreeTerritories();
            fetchMyTerritories();
        } else {
            tg.showAlert('Помилка: ' + (response.message || 'Не вдалося закріпити територію.'));
        }
        hideLoader();
    }
    
    async function returnTerritoryHandler(territory) {
        tg.showConfirm('Ви впевнені, що хочете здати цю територію?', async (isConfirmed) => {
            if (isConfirmed) {
                showLoader();
                const userId = tg.initDataUnsafe.user.id;
                const userFullName = `${tg.initDataUnsafe.user.first_name} ${tg.initDataUnsafe.user.last_name || ''}`.trim();
                const response = await fetchData('returnTerritory', { territoryId: territory.id, userId, userFullName });
                if (response.status === 'success') {
                    tg.showAlert('Територію успішно здано!');
                    fetchMyTerritories();
                    fetchFreeTerritories();
                } else {
                    tg.showAlert('Помилка: ' + (response.message || 'Не вдалося здати територію.'));
                }
                hideLoader();
            }
        });
    }

    function showImageModal(territory) {
        imageModal.style.display = 'block';
        fullImage.src = `${GITHUB_BASE_URL}${territory.category}/${territory.id}.jpg`;
        currentTerritoryId = territory.id;
        
        // Оновлюємо кнопки модального вікна
        modalDownloadBtn.style.display = 'block';
        modalInfoBtn.style.display = 'none';
        modalReturnBtn.style.display = 'none';
        
        if (document.querySelector('.tab-button.active').dataset.tab === 'my-territories') {
            modalReturnBtn.style.display = 'block';
            modalInfoBtn.style.display = 'block';
        }
        
        resetTransform();
    }

    modalCloseBtn.addEventListener('click', () => {
        imageModal.style.display = 'none';
    });

    modalDownloadBtn.addEventListener('click', () => {
        const link = document.createElement('a');
        link.href = fullImage.src;
        link.download = `territory_${currentTerritoryId}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    modalInfoBtn.addEventListener('click', async () => {
        const currentTerritory = myTerritoryList.querySelector(`[data-id="${currentTerritoryId}"]`);
        const currentInfo = currentTerritory ? currentTerritory.querySelector('.info-text').textContent : '';
        showNoteModal(currentTerritoryId, currentInfo);
    });

    modalReturnBtn.addEventListener('click', async () => {
        const currentTerritory = myTerritoryList.querySelector(`[data-id="${currentTerritoryId}"]`);
        if (currentTerritory) {
            const territoryData = {
                id: currentTerritory.dataset.id,
                name: currentTerritory.querySelector('.territory-title').textContent
            };
            returnTerritoryHandler(territoryData);
        }
    });

    // Логіка для масштабування та переміщення зображення
    function updateTransform() {
        fullImage.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    }

    function resetTransform() {
        scale = 1;
        translateX = 0;
        translateY = 0;
        updateTransform();
    }

    function getDistance(touches) {
        return Math.sqrt(
            (touches[0].clientX - touches[1].clientX) ** 2 +
            (touches[0].clientY - touches[1].clientY) ** 2
        );
    }
    
    // Миша
    imageModal.addEventListener('mousedown', (e) => {
        if (e.target !== fullImage) return;
        e.preventDefault();
        isPanning = true;
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

    imageModal.addEventListener('mouseup', () => {
        isPanning = false;
    });

    imageModal.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY * -0.01;
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

    // Touch
    imageModal.addEventListener('touchstart', (e) => {
        if (e.target !== fullImage) return;
        e.preventDefault();
        if (e.touches.length === 1) {
            isPanning = true;
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
        }
    });
    
    // Початкове завантаження
    fetchMyTerritories();
    fetchFreeTerritories();
    fetchGeneralMaps();
});