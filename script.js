const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyFlBN5_L1dr0fncI39EZuMoxnBqtW03g1--BkU9IosROoSxgqqRlTFFFrdp7GZN22M/exec";

document.addEventListener('DOMContentLoaded', function() {
    const tg = window.Telegram.WebApp;
    tg.expand();

    const loader = document.getElementById('loader');
    const myTerritoryList = document.getElementById('my-territory-list');
    const freeTerritoryList = document.getElementById('territory-list');
    const freeTerritoriesTitle = document.getElementById('free-territories-title');
    
    let allFreeTerritories = [];
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

    // --- ЛОГІКА ДЛЯ ФІЛЬТРІВ ---
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            const filter = button.dataset.filter;
            displayFreeTerritories(filter);
        });
    });

    // --- ФУНКЦІЇ ВІДОБРАЖЕННЯ ---
    function displayMyTerritories(territories) {
        myTerritoryList.innerHTML = '';
        if (territories.length === 0) {
            myTerritoryList.innerHTML = '<p>На даний час ви не маєте жодної території.</p>';
            return;
        }
        territories.forEach(t => {
            const item = document.createElement('div');
            item.className = 'territory-item';
            item.innerHTML = `<div class="territory-title">📍 ${t.id}. ${t.name}</div>`;
            myTerritoryList.appendChild(item);
        });
    }

    function displayFreeTerritories(filter) {
        freeTerritoryList.innerHTML = '';
        freeTerritoriesTitle.style.display = 'block';
        const filtered = allFreeTerritories.filter(t => t.type === filter);

        if (filtered.length === 0) {
            freeTerritoryList.innerHTML = '<p>Вільних територій цього типу немає.</p>';
            return;
        }

        filtered.forEach(t => {
            const item = document.createElement('div');
            item.className = 'territory-item';
            const photoBlock = t.photoUrl ? `<img class="territory-photo" src="${t.photoUrl}" alt="Фото">` : `<div class="placeholder-photo">Немає фото</div>`;
            item.innerHTML = `
                <div class="territory-title">📍 ${t.id}. ${t.name}</div>
                <div class="territory-content">
                    ${photoBlock}
                    <button class="btn-book" data-id="${t.id}">✅ Обрати</button>
                </div>
            `;
            freeTerritoryList.appendChild(item);
        });
        addBookingListeners();
    }

    function addBookingListeners() {
        document.querySelectorAll('.btn-book').forEach(button => {
            button.addEventListener('click', function() {
                const territoryId = this.dataset.id;
                tg.showConfirm(`Ви впевнені, що хочете взяти територію ${territoryId}?`, (isConfirmed) => {
                    if (isConfirmed) {
                        bookTerritory(territoryId, this);
                    }
                });
            });
        });
    }

    function bookTerritory(territoryId, buttonElement) {
        tg.MainButton.setText("Бронювання...").show();
        fetch(`${SCRIPT_URL}?action=bookTerritory&territoryId=${territoryId}&userId=${userId}`)
            .then(response => response.json())
            .then(result => {
                tg.MainButton.hide();
                if (result.ok) {
                    tg.showAlert(result.message);
                    buttonElement.closest('.territory-item').classList.add('booked');
                    // Оновлюємо список моїх територій
                    fetchMyTerritories();
                } else {
                    tg.showAlert(result.message);
                }
            })
            .catch(error => {
                tg.MainButton.hide();
                tg.showAlert(`Сталася помилка: ${error.message}`);
            });
    }

    // --- ЗАВАНТАЖЕННЯ ДАНИХ ---
    function fetchMyTerritories() {
        fetch(`${SCRIPT_URL}?action=getMyTerritories&userId=${userId}`)
            .then(response => response.json())
            .then(data => {
                if (data.ok) {
                    displayMyTerritories(data.territories);
                }
            });
    }

    function fetchAllFreeTerritories() {
        fetch(SCRIPT_URL)
            .then(response => response.json())
            .then(data => {
                loader.style.display = 'none';
                if (data.ok) {
                    allFreeTerritories = data.territories;
                } else {
                    document.body.innerHTML = `<p>Помилка завантаження даних: ${data.error}</p>`;
                }
            });
    }

    loader.style.display = 'block';
    fetchMyTerritories();
    fetchAllFreeTerritories();
});