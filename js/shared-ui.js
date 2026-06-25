/* =========================================================
   CARROSSEL DE AVALIAÇÕES
   ========================================================= */
let _reviewInterval = null;
let _reviewIdx = 0;

/* Calcular largura do cartão a partir do contentor exterior — evita race condition de offsetWidth=0 */
function _carouselMetrics() {
    const outer = document.querySelector('.reviews-carousel-outer');
    if (!outer) return null;
    const outerWidth = outer.clientWidth;
    if (!outerWidth) return null;
    const gap = 25;
    const perView = outerWidth < 680 ? 1 : outerWidth < 1024 ? 2 : 3;
    const cardWidth = (outerWidth - gap * (perView - 1)) / perView;
    return { gap, perView, cardWidth };
}

window.goToReview = function(idx) {
    const track = document.getElementById('reviews-track');
    if (!track) return;
    const cards = track.querySelectorAll('.review-card');
    if (!cards.length) return;
    const m = _carouselMetrics();
    if (!m) return;
    const maxIdx = Math.max(0, cards.length - m.perView);
    _reviewIdx = Math.max(0, Math.min(idx, maxIdx));
    track.style.transform = `translateX(-${_reviewIdx * (m.cardWidth + m.gap)}px)`;
    document.querySelectorAll('.carousel-dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === _reviewIdx);
    });
};

function _advanceCarousel() {
    const track = document.getElementById('reviews-track');
    if (!track) { clearInterval(_reviewInterval); _reviewInterval = null; return; }
    const cards = track.querySelectorAll('.review-card');
    if (!cards.length) return;
    const m = _carouselMetrics();
    if (!m) return;
    const maxIdx = Math.max(0, cards.length - m.perView);
    _reviewIdx = _reviewIdx >= maxIdx ? 0 : _reviewIdx + 1;
    track.style.transform = `translateX(-${_reviewIdx * (m.cardWidth + m.gap)}px)`;
    document.querySelectorAll('.carousel-dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === _reviewIdx);
    });
}

function startReviewCarousel() {
    if (_reviewInterval) clearInterval(_reviewInterval);
    _reviewInterval = setInterval(_advanceCarousel, 4200);
}

window.loadReviews = async function() {
    const grid = document.getElementById('reviews-grid');
    if (!grid) return;
    _reviewIdx = 0;
    if (_reviewInterval) clearInterval(_reviewInterval);

    try {
        const snap = await db.collection('reviews').orderBy('created_at', 'desc').limit(9).get();
        if (snap.empty) {
            grid.innerHTML = `<p style="text-align:center;color:var(--text-muted);" data-i18n="no_reviews">${window.t('no_reviews')}</p>`;
            return;
        }

        let cardsHtml = '';
        let dotsHtml = '';
        let count = 0;

        snap.forEach(doc => {
            const r = doc.data();
            const stars = '<i class="fa-solid fa-star" style="color:var(--gold);"></i>'.repeat(r.rating) +
                          '<i class="fa-regular fa-star" style="color:#444;"></i>'.repeat(5 - r.rating);
            const dateStr = r.created_at?.toDate().toLocaleDateString(
                currentLang === 'pt' ? 'pt-PT' : currentLang === 'es' ? 'es-ES' : 'en-GB'
            ) || '';
            cardsHtml += `
                <div class="review-card">
                    <div class="review-header">
                        <strong>${escapeHtml(r.client_name) || 'Anonymous'}</strong>
                        <div class="review-stars">${stars}</div>
                    </div>
                    <p class="review-text">"${escapeHtml(r.comment)}"</p>
                    <small class="review-date">${dateStr}</small>
                </div>`;
            dotsHtml += `<button class="carousel-dot ${count === 0 ? 'active' : ''}" onclick="goToReview(${count})" aria-label="Review ${count + 1}"></button>`;
            count++;
        });

        grid.innerHTML = `
            <div class="reviews-carousel-outer">
                <div class="reviews-track" id="reviews-track">${cardsHtml}</div>
            </div>
            <div class="carousel-dots">${dotsHtml}</div>`;

        // Iniciar ciclo automático
        startReviewCarousel();

        // Recalcular ao redimensionar
        window.addEventListener('resize', () => {
            if (document.getElementById('reviews-track')) window.goToReview(_reviewIdx);
        }, { passive: true });

    } catch (e) {
        console.error("Error loading reviews:", e);
        grid.innerHTML = `<p style="text-align:center;color:#ff4444;">Error loading reviews: ${e.message}</p>`;
    }
};

/* =========================================================
   UI: Modal de Destinos das Cidades
   ========================================================= */
let currentCityKey = null;
let currentImgIndex = 0;

window.openCityModal = function(cityKey) {
    const city = cityData[cityKey];
    if (!city) return;
    currentCityKey = cityKey;
    currentImgIndex = 0;

    // Usar i18n para título e descrição traduzidos
    const titleEl = document.getElementById('modalTitle');
    const descEl = document.getElementById('modalDescription');
    if (titleEl) titleEl.textContent = window.t(`city_${cityKey}_title`) || cityKey;
    if (descEl) descEl.textContent = window.t(`city_${cityKey}_desc`) || '';

    updateModalImage();
    document.getElementById('cityModal').classList.add('show');
};

window.closeCityModal = function() {
    document.getElementById('cityModal').classList.remove('show');
};

function updateModalImage() {
    const city = cityData[currentCityKey];
    if (!city) return;
    const img = document.getElementById('modalImg');
    const indexText = document.getElementById('imgIndex');
    if (img) img.src = city.images[currentImgIndex];
    if (indexText) indexText.textContent = `${currentImgIndex + 1} / ${city.images.length}`;
}

window.nextImage = function() {
    const city = cityData[currentCityKey];
    if (!city) return;
    currentImgIndex = (currentImgIndex + 1) % city.images.length;
    updateModalImage();
};

window.prevImage = function() {
    const city = cityData[currentCityKey];
    if (!city) return;
    currentImgIndex = (currentImgIndex - 1 + city.images.length) % city.images.length;
    updateModalImage();
};

window.nextCity = function() {
    const keys = Object.keys(cityData);
    let idx = (keys.indexOf(currentCityKey) + 1) % keys.length;
    window.openCityModal(keys[idx]);
};

window.prevCity = function() {
    const keys = Object.keys(cityData);
    let idx = (keys.indexOf(currentCityKey) - 1 + keys.length) % keys.length;
    window.openCityModal(keys[idx]);
};

/* =========================================================
   UI: Modal de Notas
   ========================================================= */
window.openNotesModal = function(notes) {
    const modal = document.getElementById('notesModal');
    if (!modal) return;
    const el = document.getElementById('notes-modal-text');
    if (el) el.textContent = notes && notes.trim() ? notes : window.t('no_notes');
    modal.classList.add('show');
};

// Versão segura: lê texto das notas a partir de um atributo data para evitar bugs de escape de aspas no onclick
window.openNotesFromEl = function(btn) {
    const notes = btn.getAttribute('data-notes') || '';
    window.openNotesModal(notes);
};

window.closeNotesModal = function() {
    const modal = document.getElementById('notesModal');
    if (modal) modal.classList.remove('show');
};

window.addEventListener('click', (e) => {
    const nm = document.getElementById('notesModal');
    if (e.target === nm) window.closeNotesModal();
});

/* =========================================================
   UI: Dica de Campo (Tooltip)
   ========================================================= */
window.showHint = function(btn, key) {
    const popup = document.getElementById('hint-popup');
    if (!popup) return;

    // Desligar se já estiver visível para este botão
    if (popup.dataset.anchor === key && popup.classList.contains('visible')) {
        popup.classList.remove('visible');
        return;
    }

    popup.textContent = window.t(key);
    popup.dataset.anchor = key;
    popup.classList.add('visible');

    // Posicionar relativo à viewport (posicionamento fixo — NÃO adicionar scrollY)
    const rect = btn.getBoundingClientRect();
    const popW = 260;
    let left = rect.left + rect.width / 2 - popW / 2;
    let top  = rect.bottom + 8;          // viewport-relative only
    // Inverter para cima se o popup sair do fundo da viewport
    if (top + 80 > window.innerHeight) top = rect.top - 80;
    left = Math.max(10, Math.min(left, window.innerWidth - popW - 10));
    popup.style.left = left + 'px';
    popup.style.top  = top  + 'px';
};

document.addEventListener('click', function(e) {
    if (!e.target.classList.contains('field-hint-btn')) {
        const popup = document.getElementById('hint-popup');
        if (popup) popup.classList.remove('visible');
    }
});

// Fechar dica ao fazer scroll para que nunca se afaste do seu botão
window.addEventListener('scroll', function() {
    const popup = document.getElementById('hint-popup');
    if (popup) popup.classList.remove('visible');
}, { passive: true });

/* =========================================================
   UI: Tema e Definições
   ========================================================= */
window.toggleTheme = function() {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const newTheme = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    document.querySelectorAll('#theme-btn').forEach(btn => {
        if (btn.querySelector('i')) btn.querySelector('i').className = isDark ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
    });
};

window.toggleSettings = function() {
    const dd = document.getElementById('settingsDropdown');
    if (!dd) return;
    dd.classList.toggle('show');
    const btn = dd.closest('.settings-wrapper')?.querySelector('.settings-btn');
    if (btn) btn.classList.toggle('active', dd.classList.contains('show'));
};

document.addEventListener('click', function(e) {
    const wrapper = document.querySelector('.settings-wrapper');
    const dd = document.getElementById('settingsDropdown');
    if (!wrapper || !dd) return;

    if (e.target.closest('.settings-btn')) {
        // Clicou no botão de engrenagem — alternar
        dd.classList.toggle('show');
        const btn = wrapper.querySelector('.settings-btn');
        if (btn) btn.classList.toggle('active', dd.classList.contains('show'));
    } else if (!wrapper.contains(e.target)) {
        // Clicou fora — fechar
        dd.classList.remove('show');
        const btn = wrapper.querySelector('.settings-btn');
        if (btn) btn.classList.remove('active');
    }
    // Clicked inside dropdown (lang/theme buttons) — do nothing, let their onclick handle it
});

/* =========================================================
   City Card Image Rotation
   ========================================================= */
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.city-card').forEach(card => {
        const imgs = card.querySelectorAll('.image-container img');
        if (imgs.length <= 1) return;
        let current = 0;
        setInterval(() => {
            imgs[current].classList.remove('active');
            current = (current + 1) % imgs.length;
            imgs[current].classList.add('active');
        }, 3500 + Math.random() * 1500);
    });
});

/* =========================================================
   CALENDAR RENDERING (Driver & Admin)
   ========================================================= */
let _calYear, _calMonth;

window.renderCalendar = async function(viewType) {
    const grid = document.getElementById('cal-grid');
    const title = document.getElementById('cal-title');
    if (!grid) return;

    if (!_calYear) {
        const now = new Date();
        _calYear = now.getFullYear();
        _calMonth = now.getMonth();
    }

    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    if (title) title.textContent = `${monthNames[_calMonth]} ${_calYear}`;

    const firstDay = new Date(_calYear, _calMonth, 1);
    const lastDay = new Date(_calYear, _calMonth + 1, 0);
    const startDow = firstDay.getDay(); // 0=Sun
    const daysInMonth = lastDay.getDate();

    // Fetch bookings for this month
    const monthStart = new Date(_calYear, _calMonth, 1);
    const monthEnd = new Date(_calYear, _calMonth + 1, 0, 23, 59, 59);
    const startTs = firebase.firestore.Timestamp.fromDate(monthStart);
    const endTs = firebase.firestore.Timestamp.fromDate(monthEnd);

    let bookingsSnap;
    try {
        if (viewType === 'driver') {
            const uid = auth.currentUser?.uid;
            if (!uid) return;
            bookingsSnap = await db.collection('bookings')
                .where('driver_id', '==', uid)
                .where('pickup_datetime', '>=', startTs)
                .where('pickup_datetime', '<=', endTs)
                .get();
        } else {
            bookingsSnap = await db.collection('bookings')
                .where('pickup_datetime', '>=', startTs)
                .where('pickup_datetime', '<=', endTs)
                .get();
        }
    } catch (e) {
        console.error("Calendar query error:", e);
        grid.innerHTML = `<p style="color:#ff4444;padding:20px;">Error: ${e.message}</p>`;
        return;
    }

    // Group bookings by day
    const dayBookings = {};
    bookingsSnap.forEach(doc => {
        const b = doc.data();
        const dt = b.pickup_datetime?.toDate();
        if (!dt) return;
        const dayKey = dt.getDate();
        if (!dayBookings[dayKey]) dayBookings[dayKey] = [];
        dayBookings[dayKey].push({ id: doc.id, ...b });
    });

    // Build calendar HTML
    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    let html = dayNames.map(d => `<div class="cal-day-name">${d}</div>`).join('');

    // Empty cells before first day
    for (let i = 0; i < startDow; i++) {
        html += '<div class="cal-day empty"></div>';
    }

    const today = new Date();
    const isCurrentMonth = today.getFullYear() === _calYear && today.getMonth() === _calMonth;

    for (let day = 1; day <= daysInMonth; day++) {
        const isToday = isCurrentMonth && today.getDate() === day;
        const bookings = dayBookings[day] || [];

        let bubblesHtml = '';
        bookings.forEach(b => {
            let bubbleClass = 'cal-bubble';
            if (b.status === 'completed') bubbleClass += ' cal-bubble-green';
            else if (b.status === 'no-show') bubbleClass += ' cal-bubble-red';
            else if (b.status === 'assigned' || b.status === 'waiting_for_client' || b.status === 'driving_to_destination') bubbleClass += ' cal-bubble-blue';
            else bubbleClass += ' cal-bubble-yellow'; // pending

            const timeStr = b.pickup_datetime?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '';
            const label = viewType === 'admin'
                ? `${timeStr} ${escapeHtml(b.pickup?.substring(0,8) || '')}→${escapeHtml(b.destination?.substring(0,8) || '')}`
                : `${timeStr} ${escapeHtml(b.pickup?.substring(0,10) || '')}`;

            bubblesHtml += `<div class="${bubbleClass}" title="${escapeHtml(b.pickup)} → ${escapeHtml(b.destination)} (${window.t(b.status || 'pending')})">${label}</div>`;
        });

        html += `
            <div class="cal-day ${isToday ? 'cal-today' : ''}" onclick="window.openDayModal(${day}, '${viewType}')">
                <span class="cal-day-num">${day}</span>
                <div class="cal-day-bubbles">${bubblesHtml}</div>
            </div>`;
    }

    // Fill remaining cells
    const totalCells = startDow + daysInMonth;
    const remaining = (7 - (totalCells % 7)) % 7;
    for (let i = 0; i < remaining; i++) {
        html += '<div class="cal-day empty"></div>';
    }

    grid.innerHTML = html;
};

window.prevMonth = function() {
    _calMonth--;
    if (_calMonth < 0) { _calMonth = 11; _calYear--; }
    const path = window.location.pathname;
    const viewType = path.includes('driver') ? 'driver' : 'admin';
    window.renderCalendar(viewType);
};

window.nextMonth = function() {
    _calMonth++;
    if (_calMonth > 11) { _calMonth = 0; _calYear++; }
    const path = window.location.pathname;
    const viewType = path.includes('driver') ? 'driver' : 'admin';
    window.renderCalendar(viewType);
};

window.openDayModal = async function(day, viewType) {
    const modal = document.getElementById('dayModal');
    const title = document.getElementById('day-modal-title');
    const list = document.getElementById('day-modal-list');
    if (!modal || !list) return;

    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    if (title) title.textContent = `${monthNames[_calMonth]} ${day}, ${_calYear}`;

    const dayDate = new Date(_calYear, _calMonth, day);
    const dayStart = new Date(dayDate); dayStart.setHours(0,0,0,0);
    const dayEnd = new Date(dayDate); dayEnd.setHours(23,59,59,999);
    const startTs = firebase.firestore.Timestamp.fromDate(dayStart);
    const endTs = firebase.firestore.Timestamp.fromDate(dayEnd);

    try {
        let snap;
        if (viewType === 'driver') {
            const uid = auth.currentUser?.uid;
            snap = await db.collection('bookings')
                .where('driver_id', '==', uid)
                .where('pickup_datetime', '>=', startTs)
                .where('pickup_datetime', '<=', endTs)
                .orderBy('pickup_datetime', 'asc')
                .get();
        } else {
            snap = await db.collection('bookings')
                .where('pickup_datetime', '>=', startTs)
                .where('pickup_datetime', '<=', endTs)
                .orderBy('pickup_datetime', 'asc')
                .get();
        }

        if (snap.empty) {
            list.innerHTML = '<p class="empty-bookings">No transfers on this day.</p>';
        } else {
            list.innerHTML = '';
            snap.forEach(doc => {
                const b = doc.data();
                const timeStr = b.pickup_datetime?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '';

                let statusClass = 'cal-bubble-yellow';
                if (b.status === 'completed') statusClass = 'cal-bubble-green';
                else if (b.status === 'no-show') statusClass = 'cal-bubble-red';
                else if (['assigned','waiting_for_client','driving_to_destination'].includes(b.status)) statusClass = 'cal-bubble-blue';

                const carInfo = b.car_name ? `<br><i class="fa-solid fa-car-side"></i> ${escapeHtml(b.car_name)}` : '';
                const driverInfo = b.driver_name ? `<br><i class="fa-solid fa-id-badge"></i> ${escapeHtml(b.driver_name)}` : '';

                list.innerHTML += `
                    <div class="booking-item" style="margin-bottom:12px;">
                        <div class="booking-main">
                            <strong>${escapeHtml(b.pickup) || '?'} → ${escapeHtml(b.destination) || '?'}</strong>
                            <span class="${statusClass}" style="padding:3px 9px;border-radius:20px;font-size:0.7rem;font-weight:700;">${window.t(b.status || 'pending')}</span>
                        </div>
                        <div class="booking-details">
                            <i class="fa-solid fa-clock"></i> ${timeStr}
                            &nbsp;|&nbsp; <i class="fa-solid fa-users"></i> ${b.passengers || 1} pax
                            ${driverInfo}${carInfo}
                            ${b.notes ? `<br><i class="fa-solid fa-note-sticky"></i> ${escapeHtml(b.notes)}` : ''}
                        </div>
                    </div>`;
            });
        }
    } catch (e) {
        list.innerHTML = `<p style="color:#ff4444;">Error: ${e.message}</p>`;
    }

    modal.classList.add('show');
};

window.closeDayModal = function() {
    const modal = document.getElementById('dayModal');
    if (modal) modal.classList.remove('show');
};
