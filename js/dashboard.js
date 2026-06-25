/* =========================================================
   RESERVAS DO CLIENTE (booking.html + dashboard.html)
   ========================================================= */
async function loadBookings(uid) {
    const list = document.getElementById('my-bookings-list');
    const reviewList = document.getElementById('trips-to-review-list');
    const historyList = document.getElementById('history-bookings-list');
    if (!list && !reviewList) return;

    try {
        const snap = await db.collection('bookings')
            .where('client_id', '==', uid)
            .orderBy('pickup_datetime', 'desc')
            .get();

        if (list) list.innerHTML = '';
        if (reviewList) reviewList.innerHTML = '';
        if (historyList) historyList.innerHTML = '';

        // Buscar nomes de motoristas em lote para reservas que têm driver_id mas não têm driver_name armazenado
        const driverIds = new Set();
        snap.forEach(doc => {
            const b = doc.data();
            if (b.driver_id && !b.driver_name) driverIds.add(b.driver_id);
        });
        const fetchedDriverNames = {};
        if (driverIds.size > 0) {
            const fetches = [...driverIds].map(id =>
                db.collection('users').doc(id).get()
                    .then(d => { if (d.exists) fetchedDriverNames[d.id] = d.data().full_name || 'Driver'; })
                    .catch(() => {}) // o cliente pode não ter permissão para ler o perfil do motorista — ignorar silenciosamente
            );
            await Promise.allSettled(fetches);
        }

        let hasActive = false, hasReviewable = false, hasHistory = false;

        snap.forEach(doc => {
            const b = doc.data();
            let dateStr = "N/A", timeStr = "N/A";
            if (b.pickup_datetime) {
                const dt = b.pickup_datetime.toDate();
                const loc = currentLang === 'pt' ? 'pt-PT' : currentLang === 'es' ? 'es-ES' : 'en-GB';
                dateStr = dt.toLocaleDateString(loc);
                timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }

            const isCompleted = b.status === 'completed';
            const isNoShow = b.status === 'no-show';
            const isCancelled = b.status === 'cancelled';
            const isReviewed = b.reviewed === true;
            const canCancel = b.status === 'pending' || b.status === 'assigned';
            const canReview = isCompleted && !isReviewed;
            const isActive = ['assigned', 'waiting_for_client', 'driving_to_destination'].includes(b.status);

            // Nome do motorista (do campo armazenado ou obtido)
            const driverName = b.driver_name || fetchedDriverNames[b.driver_id] || null;

            let targetList = null;
            if (canReview && reviewList) {
                targetList = reviewList;
                hasReviewable = true;
            } else if ((isCompleted && isReviewed) || isNoShow || isCancelled) {
                if (historyList) { targetList = historyList; hasHistory = true; }
                else { targetList = list; hasActive = true; }
            } else {
                targetList = list;
                if (targetList) hasActive = true;
            }

            if (!targetList) return;

            const statusKey = b.status || 'pending';

            // Telefone exibido antes da hora quando disponível
            const phoneHtml = b.phoneNumber
                ? `&nbsp;|&nbsp; <i class="fa-solid fa-phone" style="color:var(--gold);"></i> ${escapeHtml(b.phoneNumber)}`
                : '';

            // Distintivo do motorista mostrado quando atribuído/em rota
            const driverHtml = (isActive || b.status === 'assigned') && driverName
                ? `<br><i class="fa-solid fa-id-badge" style="color:var(--gold);"></i> <span style="color:var(--gold);font-weight:600;">${window.t('driver_label', {name: escapeHtml(driverName)})}</span>`
                : '';

            let actionHtml = '';
            if (canCancel) {
                actionHtml = `
                    <button class="btn-cancel-small" onclick="window.confirmCancel('${doc.id}')">
                        <i class="fa-solid fa-trash-can"></i> <span>${window.t('cancel')}</span>
                    </button>`;
            } else if (canReview) {
                actionHtml = `
                    <button class="btn-submit" style="padding:8px 16px;font-size:0.82rem;width:auto;margin-top:0;" 
                        onclick="window.openReviewModal('${doc.id}', '${b.driver_id || ''}', '${escapeHtml(b.pickup || '?')} → ${escapeHtml(b.destination || '?')}')">
                        <i class="fa-solid fa-star"></i> ${window.t('leave_review')}
                    </button>`;
            }

            targetList.innerHTML += `
                <div class="booking-item" id="booking-${doc.id}">
                    <div class="booking-main">
                        <strong>${escapeHtml(b.pickup) || '?'} <i class="fa-solid fa-arrow-right" style="font-size:0.75rem;"></i> ${escapeHtml(b.destination) || '?'}</strong>
                        <span class="status-${statusKey}">${window.t(statusKey)}</span>
                    </div>
                    <div class="booking-details">
                        <i class="fa-solid fa-calendar"></i> ${dateStr}${phoneHtml} &nbsp;|&nbsp; <i class="fa-solid fa-clock"></i> ${timeStr}<br>
                        <i class="fa-solid fa-car"></i> ${b.vehicle || 'Standard'}
                        &nbsp;|&nbsp; <i class="fa-solid fa-users"></i> ${b.passengers || 1}${b.children ? ` <small>(${b.children} <i class="fa-solid fa-child"></i>)</small>` : ''}
                        &nbsp;|&nbsp; <i class="fa-solid fa-suitcase"></i> ${(b.carryOnBags||0)}+${(b.checkedBags||0)}+${(b.luggage||0)}
                        ${b.leadPassenger ? `<br><i class="fa-solid fa-user"></i> ${escapeHtml(b.leadPassenger)}` : ''}
                        ${driverHtml}
                    </div>
                    <div class="booking-actions" style="margin-top:10px;">
                        <button class="btn-notes"
                            data-notes="${escapeHtml(b.notes || '').replace(/"/g,'&quot;')}"
                            onclick="openNotesFromEl(this)">
                            <i class="fa-solid fa-note-sticky"></i> ${window.t('view_notes')}
                        </button>
                        ${actionHtml}
                    </div>
                </div>`;
        });

        if (list && !hasActive) list.innerHTML = `<p class="empty-bookings">${window.t('no_bookings')}</p>`;
        if (reviewList && !hasReviewable) reviewList.innerHTML = `<p class="empty-bookings">${window.t('no_trips_review')}</p>`;
        if (historyList && !hasHistory) historyList.innerHTML = `<p class="empty-bookings">${window.t('no_history')}</p>`;

    } catch (e) {
        console.error("Error loading bookings:", e);
        if (list) list.innerHTML = `<p style="color:#ff4444;">Error: ${e.message}</p>`;
    }
}

/* --- Lógica de Cancelamento --- */
let bookingToDelete = null;

window.confirmCancel = function(id) {
    bookingToDelete = id;
    document.getElementById('cancelModal').classList.add('show');
};

window.closeCancelModal = function() {
    document.getElementById('cancelModal').classList.remove('show');
    bookingToDelete = null;
};

window.executeCancel = async function() {
    if (!bookingToDelete) return;
    try {
        // SEGURANÇA ZERO-COST: atualizar diretamente em vez de Cloud Function
        await db.collection('bookings').doc(bookingToDelete).update({
            status: 'cancelled',
            driver_id: '',
            driver_name: '',
            car_id: '',
            car_name: '',
            cancelled_at: firebase.firestore.FieldValue.serverTimestamp(),
            cancelled_by: auth.currentUser.uid
        });
        const el = document.getElementById(`booking-${bookingToDelete}`);
        if (el) el.remove();
        const list = document.getElementById('my-bookings-list');
        if (list && list.querySelectorAll('.booking-item').length === 0) {
            list.innerHTML = `<p class="empty-bookings">${window.t('no_bookings')}</p>`;
        }
        window.closeCancelModal();
    } catch (e) { alert("Error [" + (e.code || "?") + "]: " + e.message); }
};

window.addEventListener('click', (e) => {
    const cm = document.getElementById('cancelModal');
    if (e.target === cm) window.closeCancelModal();
});

/* =========================================================
   MODAL DE AVALIAÇÃO
   ========================================================= */
window.openReviewModal = function(bookingId, driverId, summary) {
    const modal = document.getElementById('reviewModal');
    if (!modal) return;
    document.getElementById('review-booking-id').value = bookingId;
    document.getElementById('review-driver-id').value = driverId;
    const sumEl = document.getElementById('review-booking-summary');
    if (sumEl) sumEl.textContent = summary;
    const commentEl = document.getElementById('review-comment');
    if (commentEl) commentEl.value = '';
    window.setRating(0, 'modal');
    modal.classList.add('show');
};

window.closeReviewModal = function() {
    const modal = document.getElementById('reviewModal');
    if (modal) modal.classList.remove('show');
};

window.setRating = function(val, context = 'modal') {
    const selector = context === 'modal' ? '#rating-stars-modal i' : '#rating-stars i';
    const stars = document.querySelectorAll(selector);
    const input = document.getElementById('review-rating');
    if (input) input.value = val;
    stars.forEach((s, idx) => {
        if (idx < val) {
            s.style.color = 'var(--gold)';
            s.classList.remove('fa-regular');
            s.classList.add('fa-solid');
        } else {
            s.style.color = '#444';
            s.classList.remove('fa-solid');
            s.classList.add('fa-regular');
        }
    });
};

window.submitReview = async function() {
    if (!auth.currentUser) {
        alert("Please log in to submit a review.");
        return;
    }

    const rating = parseInt(document.getElementById('review-rating').value);
    const comment = document.getElementById('review-comment').value.trim();
    const bookingId = document.getElementById('review-booking-id')?.value;
    const driverId = document.getElementById('review-driver-id')?.value;

    if (!comment || !rating || rating === 0) {
        alert(window.t('review_comment_ph') ? "Please provide a rating and a comment." : "Please provide a rating and a comment.");
        return;
    }

    /* Verificar: confirmar que a reserva está realmente concluída no Firestore */
    if (bookingId) {
        try {
            const bookingDoc = await db.collection('bookings').doc(bookingId).get();
            if (!bookingDoc.exists || bookingDoc.data().status !== 'completed') {
                alert(window.t('review_only_completed'));
                return;
            }
        } catch (e) {
            alert("Error verifying booking [" + (e.code || "?") + "]: " + e.message);
            return;
        }
    }

    // Limitação de taxa (melhor esforço do lado do cliente): máx. 1 avaliação por dia
    try {
        const now = Date.now();
        const day = 24 * 60 * 60 * 1000;
        let reviewTimes = JSON.parse(localStorage.getItem('vs_review_times') || '[]');
        reviewTimes = reviewTimes.filter(t => now - t < day);
        if (reviewTimes.length >= 1) {
            alert("Please wait before submitting another review.");
            return;
        }
        reviewTimes.push(now);
        localStorage.setItem('vs_review_times', JSON.stringify(reviewTimes));
    } catch (e) { /* ignorar erros de localStorage */ }

    try {
        const reviewData = {
            client_id: auth.currentUser.uid,
            client_name: auth.currentUser.displayName || "Anonymous Guest",
            rating,
            comment,
            booking_id: bookingId || null,
            driver_id: driverId || null,
            created_at: firebase.firestore.FieldValue.serverTimestamp()
        };

        // SEGURANÇA ZERO-COST: escrever diretamente em vez de Cloud Function
        await db.collection('reviews').add(reviewData);
        if (bookingId) {
            await db.collection('bookings').doc(bookingId).update({ reviewed: true });
        }

        alert(window.t('submit_review') ? "Review submitted! Thank you." : "Review submitted!");
        document.getElementById('review-comment').value = '';
        window.closeReviewModal();
        if (typeof window.loadReviews === 'function') window.loadReviews();
        loadBookings(auth.currentUser.uid);
    } catch (e) {
        console.error("Review error:", e);
        alert("Error submitting review [" + (e.code || "?") + "]: " + e.message);
    }
};

/* =========================================================
   ALTERNAR HISTÓRICO DO PAINEL
   ========================================================= */
window.toggleHistoryView = function() {
    const mainView = document.getElementById('dashboard-main-view');
    const historySection = document.getElementById('history-section-view');
    const toggleBtn = document.getElementById('toggle-history-btn');
    const searchInput = document.getElementById('bookings-search');
    if (!mainView || !historySection) return;

    const isHistory = !historySection.classList.contains('hidden');
    if (isHistory) {
        historySection.classList.add('hidden');
        mainView.classList.remove('hidden');
        if (toggleBtn) { toggleBtn.classList.remove('active'); toggleBtn.querySelector('span').textContent = window.t('history'); }
        if (searchInput) searchInput.oninput = (e) => filterBookings('my-bookings-list', e.target.value);
    } else {
        historySection.classList.remove('hidden');
        mainView.classList.add('hidden');
        if (toggleBtn) { toggleBtn.classList.add('active'); toggleBtn.querySelector('span').textContent = window.t('active_bookings'); }
        if (searchInput) searchInput.oninput = (e) => filterBookings('history-bookings-list', e.target.value);
    }
    if (searchInput) {
        searchInput.value = '';
        filterBookings(isHistory ? 'my-bookings-list' : 'history-bookings-list', '');
    }
};

window.filterBookings = function(listId, term) {
    const list = document.getElementById(listId);
    if (!list) return;
    const cleanTerm = term.toLowerCase().trim();
    list.querySelectorAll('.booking-item').forEach(item => {
        item.classList.toggle('hidden-search', !item.textContent.toLowerCase().includes(cleanTerm));
    });
};

/* =========================================================
   INICIALIZAÇÃO DA PÁGINA
   ========================================================= */
function initDashboardPage(user) {
    loadBookings(user.uid);
    // Re-renderizar cartões de reserva (distintivos de estado, botões) em cada mudança de idioma
    window._onLangChange = () => loadBookings(user.uid);
}

window.registerPageInit('dashboard', initDashboardPage);
