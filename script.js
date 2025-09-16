const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyFlBN5_L1dr0fncI39EZuMoxnBqtW03g1--BkU9IosROoSxgqqRlTFFFrdp7GZN22M/exec";

document.addEventListener('DOMContentLoaded', function() {
    const tg = window.Telegram.WebApp;
    tg.expand();

    const loader = document.getElementById('loader');
    const myTerritoryList = document.getElementById('my-territory-list');
    const freeTerritoryList = document.getElementById('territory-list');
    const freeTerritoriesTitle = document.getElementById('free-territories-title');
    
    let allTerritories = [];
    const userId = tg.initDataUnsafe.user.id;

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

    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            const filter = button.dataset.filter;
            displayFreeTerritories(filter);
        });
    });

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

            const photoBlock = t.picture_id ? `<img class="territory-photo" src="./images/${t.picture_id}" alt="Фото">` : `<div class="placeholder-photo">Немає фото</div>`;
            
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
        addReturnListeners();
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
            const photoBlock = t.picture_id ? `<img class="territory-photo" src="./images/${t.picture_id}" alt="Фото">` : `<div class="placeholder-photo">Немає фото</div>`;
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

    function addReturnListeners() {
        document.querySelectorAll('.btn-return').forEach(button => {
            button.addEventListener('click', function() {
                const territoryId = this.dataset.id;
                tg.showConfirm(`Ви впевнені, що хочете здати територію ${territoryId}?`, (isConfirmed) => {
                    if (isConfirmed) {
                        returnTerritory(territoryId);
                    }
                });
            });
        });
    }

    function addBookingListeners() {
        document.querySelectorAll('.btn-book').forEach(button => {
            button.addEventListener('click', function() {
                const territoryId = this.dataset.id;
                tg.showConfirm(`Ви впевнені, що хочете взяти територію ${territoryId}?`, (isConfirmed) => {
                    if (isConfirmed) {
                        bookTerritory(territoryId);
                    }
                });
            });
        });
    }

    function returnTerritory(territoryId) {
        tg.MainButton.setText("Повернення...").show().enable();
        fetch(`${SCRIPT_URL}?action=returnTerritory&territoryId=${territoryId}&userId=${userId}`)
            .then(response => response.json())
            .then(result => {
                tg.MainButton.hide();
                if (result.ok) {
                    tg.showAlert(result.message);
                    fetchAllData();
                } else {
                    tg.showAlert(result.message);
                }
            })
            .catch(error => {
                tg.MainButton.hide();
                tg.showAlert(`Сталася помилка: ${error.message}`);
            });
    }

    function bookTerritory(territoryId) {
        tg.MainButton.setText("Бронювання...").show().enable();
        fetch(`${SCRIPT_URL}?action=bookTerritory&territoryId=${territoryId}&userId=${userId}`)
            .then(response => response.json())
            .then(result => {
                tg.MainButton.hide();
                if (result.ok) {
                    const successMessage = result.message + "\n\nПам'ятайте, що термін опрацювання території - 4 місяці.";
                    tg.showAlert(successMessage);
                    fetchAllData();
                } else {
                    tg.showAlert(result.message);
                }
            })
            .catch(error => {
                tg.MainButton.hide();
                tg.showAlert(`Сталася помилка: ${error.message}`);
            });
    }

    function fetchAllData() {
        loader.style.display = 'block';
        myTerritoryList.innerHTML = '';
        
        // Запит на отримання МОЇХ та ВСІХ територій
        Promise.all([
            fetch(`${SCRIPT_URL}?action=getMyTerritories&userId=${userId}`).then(res => res.json()),
            fetch(SCRIPT_URL).then(res => res.json())
        ]).then(([myData, freeData]) => {
            loader.style.display = 'none';

            if (myData.ok) {
                displayMyTerritories(myData.territories);
            }
            
            if (freeData.ok) {
                allTerritories = freeData.territories;
                const activeFilter = document.querySelector('.filter-btn.active');
                if (activeFilter) {
                    displayFreeTerritories(activeFilter.dataset.filter);
                }
            } else {
                 document.body.innerHTML = `<p>Помилка завантаження даних: ${freeData.error}</p>`;
            }
        }).catch(error => {
            loader.style.display = 'none';
            document.body.innerHTML = `<p>Критична помилка: ${error.message}</p>`;
        });
    }
    
    fetchAllData();
});