const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyFlBN5_L1dr0fncI39EZuMoxnBqtW03g1--BkU9IosROoSxgqqRlTFFFrdp7GZN22M/exec";

document.addEventListener('DOMContentLoaded', function() {
    const tg = window.Telegram.WebApp;
    tg.expand();

    // --- ОТРИМАННЯ ЕЛЕМЕНТІВ ---
    const loader = document.getElementById('loader');
    const myTerritoryList = document.getElementById('my-territory-list');
    const freeTerritoryList = document.getElementById('territory-list');
    const freeTerritoriesTitle = document.getElementById('free-territories-title');
    const filtersContainer = document.getElementById('filters-container');
    
    const imageModal = document.getElementById('image-modal');
    const fullImage = document.getElementById('full-image');
    const closeModalBtn = document.querySelector('.modal-close-btn');
    const modalDownloadBtn = document.getElementById('modal-download-btn');

    let allTerritories = [];
    const userId = tg.initDataUnsafe.user.id;

    // --- ЛОГІКА ДЛЯ ВКЛАДОК ---
    const tabs = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(item => item.classList.remove('active'));
            tab.classList.add('active');
            const targetTab = document.getElementById(tab.dataset.tab);
            tabContents.forEach(content => content.classList.remove('active'));
            targetTab.classList.add('active');
        });
    });

    // --- ФУНКЦІЇ ДЛЯ ВІДОБРАЖЕННЯ ---
    function calculateDaysRemaining(assignDateStr) {
        if (!assignDateStr || typeof assignDateStr !== 'string') return null;
        const assigned = new Date(assignDateStr);
        if (isNaN(assigned.getTime())) return null;
        
        const deadline = new Date(assigned.getTime());
        deadline.setDate(deadline.getDate() + 120);
        
        const today = new Date();
        const diffTime = deadline - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > 0 ? diffDays : 0;
    }

    function displayMyTerritories(territories) {
        myTerritoryList.innerHTML = '';
        if (territories.length === 0) {
            myTerritoryList.innerHTML = '<p>На даний час ви не маєте жодної території.</p>';
            return;
        }
        territories.forEach(t => {
            const item = document.createElement('div');
            item.className = 'territory-item';

            const remainingDays = calculateDaysRemaining(t.date_assigned);
            let daysBlock = '';
            if (remainingDays !== null) {
                const endingSoonClass = remainingDays <= 30 ? 'ending-soon' : '';
                daysBlock = `<div class="days-remaining ${endingSoonClass}">Залишилось днів: ${remainingDays}</div>`;
            }

            const photoBlock = t.picture_id ? `<img class="territory-photo" data-id="${t.id}" src="./images/${t.picture_id}" alt="Фото">` : `<div class="placeholder-photo">Немає фото</div>`;
            
            item.innerHTML = `
                <div class="territory-title">📍 ${t.id}. ${t.name}</div>
                <div class="territory-content">
                    ${photoBlock}
                    <button class="btn-return" data-id="${t.id}">↩️ Здати</button>
                </div>
                ${daysBlock}
            `;
            myTerritoryList.appendChild(item);
        });
    }

    function displayFreeTerritories(filter) {
        freeTerritoryList.innerHTML = '';
        freeTerritoriesTitle.style.display = 'block';
        const filtered = allTerritories.filter(t => t.type === filter && t.status === 'вільна');

        if (filtered.length === 0) {
            freeTerritoryList.innerHTML = '<p>Вільних територій цього типу немає.</p>';
            return;
        }

        filtered.forEach(t => {
            const item = document.createElement('div');
            item.className = 'territory-item';
            const photoBlock = t.picture_id ? `<img class="territory-photo" data-id="${t.id}" src="./images/${t.picture_id}" alt="Фото">` : `<div class="placeholder-photo">Немає фото</div>`;
            item.innerHTML = `
                <div class="territory-title">📍 ${t.id}. ${t.name}</div>
                <div class="territory-content">
                    ${photoBlock}
                    <button class="btn-book" data-id="${t.id}">✅ Обрати</button>
                </div>
            `;
            freeTerritoryList.appendChild(item);
        });
    }

    function displayFilters(filters) {
        filtersContainer.innerHTML = '';
        filters.forEach((filter, index) => {
            const button = document.createElement('button');
            button.className = 'filter-btn';
            button.dataset.filter = filter;
            button.textContent = filter;
            if (index === 0) {
                button.classList.add('active'); // Робимо перший фільтр активним
            }
            filtersContainer.appendChild(button);
        });
    }

    // --- ОБРОБНИКИ ПОДІЙ (ДЕЛЕГУВАННЯ) ---
    myTerritoryList.addEventListener('click', function(event) {
        const target = event.target;
        if (target.classList.contains('btn-return')) {
            const territoryId = target.dataset.id;
            tg.showConfirm(`Ви впевнені, що хочете надіслати запит на повернення території ${territoryId}?`, (isConfirmed) => {
                if (isConfirmed) {
                    returnTerritory(territoryId);
                }
            });
        } else if (target.classList.contains('territory-photo')) {
            handlePhotoClick(target);
        }
    });

    freeTerritoryList.addEventListener('click', function(event) {
        const target = event.target;
        if (target.classList.contains('btn-book')) {
            requestTerritory(target.dataset.id);
        } else if (target.classList.contains('territory-photo')) {
            handlePhotoClick(target);
        }
    });
    
    filtersContainer.addEventListener('click', function(event) {
        const target = event.target;
        if (target.classList.contains('filter-btn')) {
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            target.classList.add('active');
            displayFreeTerritories(target.dataset.filter);
        }
    });

    function handlePhotoClick(photoElement) {
        fullImage.src = photoElement.src;
        imageModal.dataset.imageUrl = photoElement.src;
        imageModal.dataset.territoryId = photoElement.dataset.id;
        imageModal.classList.add('active');
    }

    // --- ОБРОБНИКИ ДЛЯ МОДАЛЬНОГО ВІКНА ---
    closeModalBtn.addEventListener('click', () => {
        imageModal.classList.remove('active');
    });
    imageModal.addEventListener('click', (e) => {
        if (e.target === imageModal) {
            imageModal.classList.remove('active');
        }
    });
    modalDownloadBtn.addEventListener('click', () => {
        const imageUrl = imageModal.dataset.imageUrl;
        const territoryId = imageModal.dataset.territoryId;
        
        tg.showPopup({title: 'Завантаження...', message: 'Готуємо файл...'});

        fetch(imageUrl)
            .then(response => response.blob())
            .then(blob => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = `territory_${territoryId}.jpg`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                a.remove();
                tg.closePopup();
            })
            .catch(() => {
                tg.showAlert('Не вдалося завантажити файл. Спробуйте зберегти його вручну.');
            });
    });

    // --- ФУНКЦІЇ API ---
    function returnTerritory(territoryId) {
        tg.MainButton.setText("Надсилаю запит...").show().enable();
        fetch(`${SCRIPT_URL}?action=returnTerritory&territoryId=${territoryId}&userId=${userId}`)
            .then(response => response.json())
            .then(result => {
                tg.MainButton.hide();
                if (result.ok) {
                    tg.showAlert(result.message);
                    fetchAllData(); // Автоматичне оновлення інтерфейсу
                } else {
                    tg.showAlert(result.message || result.error || 'Сталася невідома помилка.');
                }
            })
            .catch(error => {
                tg.MainButton.hide();
                tg.showAlert('Сталася критична помилка. Спробуйте пізніше.');
            });
    }

    function requestTerritory(territoryId) {
        tg.MainButton.setText("Надсилаю запит...").show().enable();
        fetch(`${SCRIPT_URL}?action=requestTerritory&territoryId=${territoryId}&userId=${userId}`)
            .then(response => response.json())
            .then(result => {
                tg.MainButton.hide();
                if (result.ok) {
                    tg.showAlert(result.message);
                    fetchAllData(); // Автоматичне оновлення інтерфейсу
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
        
        Promise.all([
            fetch(`${SCRIPT_URL}?action=getMyTerritories&userId=${userId}`).then(res => res.json()),
            fetch(SCRIPT_URL).then(res => res.json()) // Отримуємо всі території та фільтри
        ]).then(([myData, allData]) => {
            loader.style.display = 'none';

            if (myData.ok) {
                displayMyTerritories(myData.territories);
            }
            
            if (allData.ok) {
                allTerritories = allData.territories;

                // --- НОВА ЛОГІКА СОРТУВАННЯ ФІЛЬТРІВ ---
                const predefinedOrder = ["Тернопіль", "Березовиця", "Острів", "Буцнів"];

                function getDistance(name) {
                    const match = name.match(/\((\d+)км\)/);
                    return match ? parseInt(match[1], 10) : Infinity;
                }

                const sortedFilters = allData.filters.sort((a, b) => {
                    const indexA = predefinedOrder.indexOf(a);
                    const indexB = predefinedOrder.indexOf(b);

                    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                    if (indexA !== -1) return -1;
                    if (indexB !== -1) return 1;
                    
                    const distanceA = getDistance(a);
                    const distanceB = getDistance(b);
                    
                    return distanceA - distanceB;
                });
                // --- КІНЕЦЬ ЛОГІКИ СОРТУВАННЯ ---

                displayFilters(sortedFilters); // Передаємо відсортований масив
                
                const activeFilter = document.querySelector('.filter-btn.active');
                if (activeFilter) {
                    displayFreeTerritories(activeFilter.dataset.filter);
                }
            } else {
                 document.body.innerHTML = `<p>Помилка завантаження даних: ${allData.error}</p>`;
            }
        }).catch(error => {
            loader.style.display = 'none';
            document.body.innerHTML = `<p>Критична помилка. Не вдалося завантажити дані.</p>`;
        });
    }
    
    // --- ПОЧАТКОВЕ ЗАВАНТАЖЕННЯ ---
    fetchAllData();
});