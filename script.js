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
    const closeModalBtn = document.querySelector('.modal-close-btn');
    const modalDownloadBtn = document.getElementById('modal-download-btn');
    
    // Нові елементи для адміністратора
    const adminTab = document.getElementById('admin-tab');
    const adminTerritoryList = document.getElementById('admin-territory-list');
    const adminFilters = document.querySelectorAll('.admin-filters .filter-btn');
    const adminSearchIcon = document.getElementById('admin-search-icon');
    const adminSearchInput = document.getElementById('admin-search-input');
    
    let allTerritories = [];
    let is_admin = false;
    const userId = tg.initDataUnsafe.user.id;

    async function checkAdminStatusAndLoad() {
        showLoader();
        try {
            const response = await fetch(`${SCRIPT_URL}?action=getIsAdmin&userId=${userId}`);
            const data = await response.json();
            is_admin = data.isAdmin;
            if (is_admin) {
                adminTab.style.display = 'block';
            }
            fetchAllData();
        } catch (error) {
            console.error('Failed to check admin status:', error);
            document.body.innerHTML = `<p>Критична помилка. Не вдалося завантажити дані.</p>`;
        }
    }
    
    checkAdminStatusAndLoad();

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
            } else if (targetTabId === 'general-maps') {
                fetchGeneralMaps();
            } else if (targetTabId === 'all-territories' && is_admin) {
                fetchAllTerritoriesForAdmin();
            }
        });
    });

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
                    const activeFilter = document.querySelector('#select-territory .filter-btn.active');
                    if (activeFilter) {
                        displayFreeTerritories(activeFilter.dataset.filter);
                    } else if (allData.filters && allData.filters.length > 0) {
                        displayFilters(allData.filters);
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

    function fetchGeneralMaps() {
        generalMapsList.innerHTML = `<div class="loader" style="font-size: 16px;">Оновлення...</div>`;
        fetch(SCRIPT_URL)
            .then(res => res.json())
            .then(allData => {
                if (allData.ok) {
                    allTerritories = allData.territories;
                    displayGeneralMaps();
                } else {
                    generalMapsList.innerHTML = '<p>Не вдалося оновити дані.</p>';
                }
            })
            .catch(error => {
                console.error('Fetch error:', error);
                generalMapsList.innerHTML = '<p>Помилка мережі. Спробуйте пізніше.</p>';
            });
    }
    
    function fetchAllTerritoriesForAdmin() {
      adminTerritoryList.innerHTML = `<div class="loader" style="font-size: 16px;">Оновлення...</div>`;
      fetch(`${SCRIPT_URL}?action=getAllTerritories`)
          .then(res => res.json())
          .then(data => {
            if (data.ok) {
              allTerritories = data.territories;
              displayAdminTerritories('all');
            } else {
              adminTerritoryList.innerHTML = '<p>Не вдалося завантажити дані.</p>';
            }
          })
          .catch(error => {
            console.error('Fetch error:', error);
            adminTerritoryList.innerHTML = '<p>Помилка мережі. Спробуйте пізніше.</p>';
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

    // Нова функція для відображення всіх територій для адміністратора
    function displayAdminTerritories(filter, searchTerm = '') {
        adminTerritoryList.innerHTML = '';
        
        let filtered = allTerritories.filter(t => t.category === 'territory');
        
        if (filter !== 'all') {
            if (filter === 'рідко опрацьовані') {
                filtered = filtered.filter(t => isPriorityTerritory(t.date_completed));
            } else {
                filtered = filtered.filter(t => t.status === filter);
            }
        }

        if (searchTerm) {
          filtered = filtered.filter(t => 
            t.id.toString().includes(searchTerm) || t.name.toLowerCase().includes(searchTerm.toLowerCase())
          );
        }

        if (filtered.length === 0) {
            adminTerritoryList.innerHTML = '<p>Немає територій, що відповідають фільтру.</p>';
            return;
        }

        filtered.forEach(t => {
            const item = document.createElement('div');
            item.className = `territory-item status-${t.status}`;
            item.dataset.territoryId = t.id;

            const isPriority = isPriorityTerritory(t.date_completed);
            if (isPriority) {
                item.classList.add('priority');
            }

            const assigneeInfo = t.status === 'зайнята' ? 
                `<p class="admin-info">Зайнято: <span>${t.assignee_name}</span><br>Призначено: ${t.date_assigned}</p>` : '';
            
            const actionButtons = `
                <div class="admin-buttons">
                    <button class="btn admin-assign">Призначити</button>
                    ${t.status === 'зайнята' ? `<button class="btn admin-return">Здати</button><button class="btn admin-extend">Продовжити</button>` : ''}
                    <button class="btn admin-history">Історія</button>
                    <button class="btn admin-note">Примітка</button>
                </div>
            `;

            item.innerHTML = `
                <div class="territory-title"><span>📍 ${t.id}. ${t.name}</span> ${createNoteIcon(t)}</div>
                <div class="territory-content">
                    ${createPhotoBlock(t)}
                    <div class="action-area">
                        ${assigneeInfo}
                        ${actionButtons}
                    </div>
                </div>
            `;
            adminTerritoryList.appendChild(item);
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
            const container = target.closest('.filters') || target.closest('.admin-filters');
            container.querySelector('.active')?.classList.remove('active');
            target.classList.add('active');
            
            if (container.closest('#select-territory')) {
                displayFreeTerritories(target.dataset.filter);
            } else if (container.closest('#all-territories')) {
                displayAdminTerritories(target.dataset.status);
            }
        }
        
        // Обробники для адміністративних кнопок
        if (is_admin) {
          const territoryItem = target.closest('.territory-item');
          if (!territoryItem) return;
          const territoryId = territoryItem.dataset.territoryId;

          if (target.classList.contains('admin-assign')) {
              // Логіка для "Призначити"
              const newUserId = prompt("Введіть ID користувача:");
              if (newUserId) {
                  fetch(`${SCRIPT_URL}?action=assignTerritoryAdmin&territoryId=${territoryId}&newUserId=${newUserId}`)
                      .then(res => res.json())
                      .then(data => {
                          tg.showAlert(data.message);
                          if (data.ok) fetchAllTerritoriesForAdmin();
                      });
              }
          }
          if (target.classList.contains('admin-return')) {
              // Логіка для "Здати"
              if (confirm('Ви впевнені, що хочете повернути цю територію?')) {
                  fetch(`${SCRIPT_URL}?action=returnTerritoryAdmin&territoryId=${territoryId}`)
                      .then(res => res.json())
                      .then(data => {
                          tg.showAlert(data.message);
                          if (data.ok) fetchAllTerritoriesForAdmin();
                      });
              }
          }
          if (target.classList.contains('admin-extend')) {
              // Логіка для "Продовжити"
              if (confirm('Ви впевнені, що хочете продовжити опрацювання цієї території?')) {
                  fetch(`${SCRIPT_URL}?action=extendTerritoryAdmin&territoryId=${territoryId}`)
                      .then(res => res.json())
                      .then(data => {
                          tg.showAlert(data.message);
                          if (data.ok) fetchAllTerritoriesForAdmin();
                      });
              }
          }
          if (target.classList.contains('admin-history')) {
              // Логіка для "Історія"
              fetch(`${SCRIPT_URL}?action=getTerritoryHistory&territoryId=${territoryId}`)
                  .then(res => res.json())
                  .then(data => {
                      if (data.ok) {
                          let historyText = "Історія:\n";
                          data.history.forEach(h => {
                              historyText += `${h.date}: ${h.action} - ${h.user_name}\n`;
                          });
                          tg.showAlert(historyText);
                      } else {
                          tg.showAlert(data.message);
                      }
                  });
          }
          if (target.classList.contains('admin-note')) {
              // Логіка для "Примітка"
              const newNote = prompt("Введіть нову примітку:");
              if (newNote !== null) {
                  fetch(`${SCRIPT_URL}?action=updateTerritoryNote&territoryId=${territoryId}&newNote=${encodeURIComponent(newNote)}`)
                      .then(res => res.json())
                      .then(data => {
                          tg.showAlert(data.message);
                          if (data.ok) fetchAllTerritoriesForAdmin();
                      });
              }
          }
        }
    });

    adminSearchIcon.addEventListener('click', () => {
        adminSearchInput.style.display = adminSearchInput.style.display === 'none' ? 'block' : 'none';
        if (adminSearchInput.style.display === 'none') {
          adminSearchInput.value = '';
          displayAdminTerritories(document.querySelector('.admin-filters .active').dataset.status, '');
        }
    });

    adminSearchInput.addEventListener('input', () => {
        const searchTerm = adminSearchInput.value;
        const currentFilter = document.querySelector('.admin-filters .active').dataset.status;
        displayAdminTerritories(currentFilter, searchTerm);
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
        
        Promise.all([
            fetch(`${SCRIPT_URL}?action=getMyTerritories&userId=${userId}`).then(res => res.json()),
            fetch(SCRIPT_URL).then(res => res.json())
        ]).then(([myData, allData]) => {
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
});