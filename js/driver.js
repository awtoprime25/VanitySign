/* =========================================================
   TRANSFERS DO MOTORISTA — FLUXO DE 4 PASSOS
   ========================================================= */
/*
 * Fluxo de estados:
 *  assigned  ->  [Iniciar Viagem]  ->  waiting_for_client
 *  waiting_for_client  ->  [Cliente a Bordo] ou [No-Show]  ->  driving_to_destination / no-show
 *  driving_to_destination  ->  [Completar Viagem]  ->  completed
 *  completed / no-show  -> (final, sem ações)
 */
const DRIVER_STEPS = ['assigned', 'waiting_for_client', 'driving_to_destination', 'completed'];

function getStepIndex(status) {
    const idx = DRIVER_STEPS.indexOf(status);
    return idx >= 0 ? idx : (status === 'no-show' ? 4 : 0);
}

function buildDriverProgress(status) {
    const steps = [
        { key: 'assigned',                icon: 'fa-check',       label: window.t('assigned') || 'Assigned' },
        { key: 'waiting_for_client',       icon: 'fa-hourglass',   label: window.t('waiting_for_client') || 'Waiting' },
        { key: 'driving_to_destination',   icon: 'fa-car',         label: window.t('driving_to_destination') || 'Driving' },
        { key: 'completed',                icon: 'fa-flag-checkered', label: window.t('completed') || 'Completed' }
    ];

    const currentIdx = getStepIndex(status);
    const isNoShow = status === 'no-show';

    let html = '<div class="driver-progress">';
    steps.forEach((step, i) => {
        let cls = '';
        if (i < currentIdx) cls = 'done';
        else if (i === currentIdx && !isNoShow) cls = 'active';

        html += `
            <div class="progress-step ${cls}">
                <div class="step-dot"><i class="fa-solid ${step.icon}" style="font-size:0.7rem;"></i></div>
                <span class="step-label">${step.label}</span>
            </div>`;
    });
    html += '</div>';
    return html;
}

function buildDriverActions(docId, status) {
    if (status === 'completed' || status === 'no-show') return '';

    let html = '<div class="driver-action-btns">';
    if (status === 'assigned') {
        html += `<button class="btn-driver btn-driver-primary" onclick="window.updateStatus('${docId}', 'waiting_for_client')">
                    <i class="fa-solid fa-play"></i> ${window.t('btn_start_trip')}
                 </button>`;
    } else if (status === 'waiting_for_client') {
        html += `<button class="btn-driver btn-driver-success" onclick="window.updateStatus('${docId}', 'driving_to_destination')">
                    <i class="fa-solid fa-user-check"></i> ${window.t('btn_picked_up')}
                 </button>
                 <button class="btn-driver btn-driver-danger" onclick="window.updateStatus('${docId}', 'no-show')">
                    <i class="fa-solid fa-user-xmark"></i> ${window.t('btn_no_show')}
                 </button>`;
    } else if (status === 'driving_to_destination') {
        html += `<button class="btn-driver btn-driver-primary" onclick="window.updateStatus('${docId}', 'completed')">
                    <i class="fa-solid fa-flag-checkered"></i> ${window.t('btn_complete_trip')}
                 </button>`;
    }
    html += '</div>';
    return html;
}

/* Estados ativos vão para a lista principal; completed/no-show vão para o histórico */
const DRIVER_ACTIVE_STATUSES = ['assigned', 'waiting_for_client', 'driving_to_destination'];

function buildDriverCard(doc) {
    const b = doc.data();
    const loc = currentLang === 'pt' ? 'pt-PT' : currentLang === 'es' ? 'es-ES' : 'en-GB';
    let dateStr = 'N/A', timeStr = 'N/A';
    if (b.pickup_datetime) {
        const dt = b.pickup_datetime.toDate();
        dateStr = dt.toLocaleDateString(loc);
        timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    const statusKey = b.status || 'pending';
    const progressHtml = buildDriverProgress(statusKey);
    const actionHtml = buildDriverActions(doc.id, statusKey);
    const atWord = window.t('at_time') || 'at';

    return `
        <div class="booking-item" id="driver-booking-${doc.id}" style="margin-bottom:20px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:15px;flex-wrap:wrap;">
                <div style="flex:1;min-width:200px;">
                    <div style="font-size:1.05rem;font-weight:700;color:var(--gold);margin-bottom:6px;">
                        ${escapeHtml(b.pickup) || '?'} <i class="fa-solid fa-arrow-right" style="font-size:0.8rem;"></i> ${escapeHtml(b.destination) || '?'}
                    </div>
                    <div class="booking-details">
                        <i class="fa-solid fa-calendar"></i> ${dateStr} ${atWord} ${timeStr}<br>
                        <i class="fa-solid fa-user"></i> ${escapeHtml(b.leadPassenger || b.client_name) || '—'}
                        &nbsp;|&nbsp; <i class="fa-solid fa-phone"></i> ${escapeHtml(b.phoneNumber) || '—'}<br>
                        <i class="fa-solid fa-car"></i> ${b.vehicle || 'Standard'}
                        &nbsp;|&nbsp; <i class="fa-solid fa-users"></i> ${b.passengers || 1}${b.children ? ` (${b.children} <i class="fa-solid fa-child"></i>)` : ''}<br>
                        <i class="fa-solid fa-suitcase"></i>
                        ${window.t('carry_on_luggage')}: ${b.carryOnBags||0}
                        &nbsp;&middot;&nbsp; ${window.t('checked_luggage')}: ${b.checkedBags||0}
                        ${b.flightNumber ? `<br><i class="fa-solid fa-plane"></i> ${escapeHtml(b.flightNumber)}` : ''}
                    </div>
                    <div style="margin-top:8px;">
                        <button class="btn-notes"
                            data-notes="${escapeHtml(b.notes || '').replace(/"/g,'&quot;')}"
                            onclick="openNotesFromEl(this)">
                            <i class="fa-solid fa-note-sticky"></i> ${window.t('view_notes')}
                        </button>
                    </div>
                </div>
                <span class="status-${statusKey}" style="align-self:flex-start;">${window.t(statusKey)}</span>
            </div>
            ${progressHtml}
            ${actionHtml}
        </div>`;
}

async function loadDriverTransfers(uid) {
    const activeList = document.getElementById('driver-transfers-list');
    const historyList = document.getElementById('driver-history-list');
    if (!activeList) return;

    try {
        // Buscar todas as transfers para este motorista, mais recentes primeiro no histórico, mais antigas primeiro nas ativas
        const snap = await db.collection('bookings')
            .where('driver_id', '==', uid)
            .orderBy('pickup_datetime', 'asc')
            .get();

        const activeDocs = [];
        const historyDocs = [];

        snap.forEach(doc => {
            const status = doc.data().status || 'pending';
            if (DRIVER_ACTIVE_STATUSES.includes(status)) {
                activeDocs.push(doc);
            } else if (status === 'completed' || status === 'no-show') {
                historyDocs.push(doc);
            } else {
                activeDocs.push(doc); // pendente, etc.
            }
        });

        // Renderizar lista ativa
        if (activeDocs.length === 0) {
            activeList.innerHTML = `<p class="empty-bookings">${window.t('no_assigned_transfers')}</p>`;
        } else {
            activeList.innerHTML = '';
            activeDocs.forEach(doc => { activeList.innerHTML += buildDriverCard(doc); });
        }

        // Renderizar lista de histórico (ordenadas mais recentes primeiro)
        if (historyList) {
            historyDocs.sort((a, b) => {
                const dtA = a.data().pickup_datetime?.toDate() || new Date(0);
                const dtB = b.data().pickup_datetime?.toDate() || new Date(0);
                return dtB - dtA;
            });
            if (historyDocs.length === 0) {
                historyList.innerHTML = `<p class="empty-bookings">${window.t('no_driver_history')}</p>`;
            } else {
                historyList.innerHTML = '';
                historyDocs.forEach(doc => { historyList.innerHTML += buildDriverCard(doc); });
            }
        }

    } catch (e) {
        console.error('Driver load error:', e);
        if (activeList) activeList.innerHTML = `<p style="color:#ff4444;">Error: ${e.message}</p>`;
    }
}

window.toggleDriverHistory = function() {
    const activeSection = document.getElementById('driver-active-section');
    const historySection = document.getElementById('driver-history-section');
    const btn = document.getElementById('driver-history-btn');
    if (!activeSection || !historySection) return;

    const showingHistory = !historySection.classList.contains('hidden');
    if (showingHistory) {
        historySection.classList.add('hidden');
        activeSection.classList.remove('hidden');
        if (btn) { btn.classList.remove('active'); btn.querySelector('span').textContent = window.t('driver_history'); }
    } else {
        activeSection.classList.add('hidden');
        historySection.classList.remove('hidden');
        if (btn) { btn.classList.add('active'); btn.querySelector('span').textContent = window.t('show_active'); }
    }
};

window.updateStatus = async function(id, newStatus) {
    try {
        // SEGURANÇA ZERO-COST: atualizar diretamente em vez de Cloud Function
        await db.collection('bookings').doc(id).update({ status: newStatus });
        loadDriverTransfers(auth.currentUser.uid);
    } catch (e) { alert("Error [" + (e.code || "?") + "]: " + e.message); }
};

/* =========================================================
   INICIALIZAÇÃO DA PÁGINA
   ========================================================= */
function initDriverPage(user) {
    loadDriverTransfers(user.uid);
    // Re-renderizar cartões do motorista (badges de estado, botões de ação) em cada mudança de idioma
    window._onLangChange = () => loadDriverTransfers(user.uid);
}

window.registerPageInit('driver', initDriverPage);
