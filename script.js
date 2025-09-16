// --- ВАЖЛИВЕ НАЛАШТУВАННЯ ---
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyFlBN5_L1dr0fncI39EZuMoxnBqtW03g1--BkU9IosROoSxgqqRlTFFFrdp7GZN22M/exec";
// ------------------------------

document.addEventListener('DOMContentLoaded', function() {
    const tg = window.Telegram.WebApp;
    tg.expand();

    const territoryList = document.getElementById('territory-list');
    const loader = document.getElementById('loader');
    const filterUrbanBtn = document.getElementById('filter-urban');
    const filterRuralBtn = document.getElementById('filter-rural');
    let allTerritories = [];
    
    function displayTerritories(filter) {
        territoryList.innerHTML = '';
        const filtered = allTerritories.filter(t => t.type === filter);

        if (filtered.length === 0) {
            territoryList.innerHTML = '<p>Вільних територій цього типу немає.</p>';
            return;
        }

        filtered.forEach(t => {
            const item = document.createElement('div');
            item.className = 'territory-item';
            
            const photoBlock = t.photoUrl
                ? `<img class="territory-photo" src="${t.photoUrl}" alt="Фото території">`
                : `<div class="placeholder-photo">Немає фото</div>`;

            item.innerHTML = `
                <div class="territory-title">📍 ${t.id}. ${t.name}</div>
                <div class="territory-content">
                    ${photoBlock}
                    <button class="btn-book" data-id="${t.id}">✅ Обрати</button>
                </div>
            `;
            territoryList.appendChild(item);
        });

        document.querySelectorAll('.btn-book').forEach(button => {
            button.addEventListener('click', function() {
                const territoryId = this.dataset.id;
                const userId = tg.initDataUnsafe.user.id;
                
                tg.showConfirm(`Ви впевнені, що хочете взяти територію ${territoryId}?`, (isConfirmed) => {
                    if (isConfirmed) {
                        tg.showPopup({title: 'Бронювання...', message: 'Будь ласка, зачекайте.'});

                        fetch(`${SCRIPT_URL}?action=book&territoryId=${territoryId}&userId=${userId}`)
                            .then(response => response.json())
                            .then(result => {
                                if (result.ok) {
                                    tg.showPopup({title: 'Успіх!', message: result.message});
                                    button.closest('.territory-item').classList.add('booked');
                                } else {
                                    tg.showAlert(result.message);
                                }
                            })
                            .catch(error => tg.showAlert(`Сталася помилка: ${error.message}`));
                    }
                });
            });
        });
    }

    loader.style.display = 'block';
    fetch(SCRIPT_URL)
        .then(response => response.json())
        .then(data => {
            loader.style.display = 'none';
            if (data.ok) {
                allTerritories = data.territories;
                displayTerritories('міська');
            } else {
                territoryList.innerHTML = `<p>Помилка завантаження даних: ${data.error}</p>`;
            }
        })
        .catch(error => {
            loader.style.display = 'none';
            territoryList.innerHTML = `<p>Критична помилка: ${error.message}</p>`;
        });

    // --- ВИПРАВЛЕНО: Додано логіку для фільтрів ---
    filterUrbanBtn.addEventListener('click', () => {
        displayTerritories('міська');
        filterUrbanBtn.classList.add('active');
        filterRuralBtn.classList.remove('active');
    });

    filterRuralBtn.addEventListener('click', () => {
        displayTerritories('сільська');
        filterRuralBtn.classList.add('active');
        filterUrbanBtn.classList.remove('active');
    });
    // ------------------------------------------
});