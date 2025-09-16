// --- ВАЖЛИВЕ НАЛАШТУВАННЯ ---
const SCRIPT_URL = "СЮДИ_ВСТАВИТИ_URL_АДРЕСУ_ВАШОГО_ВЕБ_ДОДАТКУ";
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
            
            // --- НОВА ЗМІНА: Будуємо шлях до фото самостійно ---
            const photoBlock = t.picture_id
                ? `<img class="territory-photo" src="./images/${t.picture_id}" alt="Фото території">`
                : `<div class="placeholder-photo">Немає фото</div>`;
            // ------------------------------------------

            item.innerHTML = `
                <div class="territory-title">📍 ${t.id}. ${t.name}</div>
                <div class="territory-content">
                    ${photoBlock}
                    <button class="btn-book">✅ Обрати</button>
                </div>
            `;
            territoryList.appendChild(item);
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
});