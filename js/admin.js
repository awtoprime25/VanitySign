/* =========================================================
   PAINEL DE ADMINISTRAÇÃO
   ========================================================= */
let allUsers = [];

function renderUsers(usersList) {
    const usersContainer = document.getElementById('admin-users-list');
    if (!usersContainer) return;
    usersContainer.innerHTML = '';
    if (usersList.length === 0) {
        usersContainer.innerHTML = '<p style="color:var(--text-muted);padding:20px;text-align:center;">No users found.</p>';
        return;
    }
    usersList.forEach(u => {
        usersContainer.innerHTML += `
            <div class="card" style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:15px;flex-wrap:wrap;">
                <div>
                    <strong>${escapeHtml(u.full_name) || 'No Name'}</strong> (${escapeHtml(u.email) || 'No Email'})<br>
                    <small style="color:var(--text-muted);">ID: ${u.id} | Joined: ${u.created_at?.toDate().toLocaleDateString() || 'N/A'}</small>
                </div>
                <div style="display:flex;gap:10px;align-items:center;">
                    <label style="font-size:0.8rem;color:var(--text-muted);">Role:</label>
                    <select onchange="window.updateUserRole('${u.id}', this.value)" style="padding:6px;border-radius:6px;background:#333;color:#fff;">
                        <option value="client" ${u.role==='client'?'selected':''}>Client</option>
                        <option value="driver" ${u.role==='driver'?'selected':''}>Driver</option>
                        <option value="admin"  ${u.role==='admin'?'selected':''}>Admin</option>
                    </select>
                </div>
            </div>`;
    });
}

async function loadAdminDashboard() {
    const unassignedContainer = document.getElementById('admin-unassigned-list');
    const reviewsContainer = document.getElementById('admin-reviews-list');
    const searchInput = document.getElementById('admin-user-search');
    if (!unassignedContainer) return;
    if (!db) { unassignedContainer.innerHTML = '<p style="color:#ff4444;">Error: Database not initialized.</p>'; return; }

    if (searchInput && !searchInput.dataset.listenerAdded) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = allUsers.filter(u =>
                (u.full_name && u.full_name.toLowerCase().includes(term)) ||
                (u.email && u.email.toLowerCase().includes(term)) ||
                (u.id && u.id.toLowerCase().includes(term))
            );
            renderUsers(filtered);
        });
        searchInput.dataset.listenerAdded = 'true';
    }

    try {
        // Motoristas
        const driversSnap = await db.collection('users').where('role', '==', 'driver').get();
        let driverOptions = '<option value="">Assign Driver...</option>';
        driversSnap.forEach(d => {
            const dd = d.data();
            driverOptions += `<option value="${d.id}">${dd.full_name || dd.email}</option>`;
        });

        // Carros
        const carsSnap = await db.collection('cars').where('active', '==', true).get();
        let carOptions = '<option value="">Assign Car...</option>';
        carsSnap.forEach(c => {
            const cd = c.data();
            carOptions += `<option value="${c.id}">${cd.name} (${cd.plate})</option>`;
        });

        // Reservas pendentes
        const bookingsSnap = await db.collection('bookings')
            .where('status', '==', 'pending')
            .orderBy('pickup_datetime', 'asc')
            .get();

        if (bookingsSnap.empty) {
            unassignedContainer.innerHTML = '<p class="empty-bookings">All transfers are assigned or none exist.</p>';
        } else {
            unassignedContainer.innerHTML = '';
            bookingsSnap.forEach(doc => {
                const b = doc.data();
                const loc = currentLang === 'pt' ? 'pt-PT' : currentLang === 'es' ? 'es-ES' : 'en-GB';
                let dateStr = "N/A", timeStr = "N/A";
                if (b.pickup_datetime) {
                    const dt = b.pickup_datetime.toDate();
                    dateStr = dt.toLocaleDateString(loc);
                    timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                }
                unassignedContainer.innerHTML += `
                    <div class="card" style="margin-bottom:15px;">
                        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:20px;flex-wrap:wrap;">
                            <div style="flex:1;min-width:250px;">
                                <strong style="color:var(--gold);font-size:1.05rem;">${escapeHtml(b.pickup)} → ${escapeHtml(b.destination)}</strong><br>
                                <small>${dateStr} ${timeStr} | ${b.passengers} Pax | ${b.vehicle || 'Standard'}</small><br>
                                <small style="color:var(--text-muted);">Client: ${escapeHtml(b.leadPassenger || b.client_name) || 'Anonymous'} (${escapeHtml(b.phoneNumber) || 'No phone'})</small>
                                ${b.driver_name ? `<br><small style="color:#4d9fff;"><i class="fa-solid fa-id-badge"></i> Driver: ${escapeHtml(b.driver_name)}</small>` : ''}
                                ${b.car_name ? `<br><small style="color:#2ecc71;"><i class="fa-solid fa-car"></i> Car: ${escapeHtml(b.car_name)}</small>` : ''}
                                ${b.notes ? `<br><small style="color:var(--gold);">Note: ${escapeHtml(b.notes)}</small>` : ''}
                            </div>
                            <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
                                <select data-booking="${doc.id}" class="assign-driver-select" style="padding:8px;border-radius:6px;background:#333;color:#fff;border:1px solid #444;min-width:150px;">
                                    ${driverOptions}
                                </select>
                                <select data-booking="${doc.id}" class="assign-car-select" style="padding:8px;border-radius:6px;background:#333;color:#fff;border:1px solid #444;min-width:150px;">
                                    ${carOptions}
                                </select>
                                <button onclick="window.assignDriverAndCar('${doc.id}')" style="padding:8px 16px;border-radius:6px;background:var(--gold);color:#000;border:none;cursor:pointer;font-weight:600;white-space:nowrap;">
                                    <i class="fa-solid fa-check"></i> ${window.t('btn_assign') || 'Assign'}
                                </button>
                            </div>
                        </div>
                    </div>`;
            });
        }

        // Utilizadores
        const usersSnap = await db.collection('users').get();
        allUsers = [];
        usersSnap.forEach(doc => allUsers.push({ id: doc.id, ...doc.data() }));
        const term = searchInput?.value?.toLowerCase() || '';
        renderUsers(term ? allUsers.filter(u =>
            (u.full_name && u.full_name.toLowerCase().includes(term)) ||
            (u.email && u.email.toLowerCase().includes(term))
        ) : allUsers);

        // Avaliações
        const reviewsSnap = await db.collection('reviews').orderBy('created_at', 'desc').get();
        if (reviewsContainer) {
            reviewsContainer.innerHTML = '';
            reviewsSnap.forEach(doc => {
                const r = doc.data();
                const stars = '<i class="fa-solid fa-star" style="color:var(--gold);"></i>'.repeat(r.rating) +
                              '<i class="fa-regular fa-star" style="color:#444;"></i>'.repeat(5 - r.rating);
                reviewsContainer.innerHTML += `
                    <div class="card" style="position:relative;">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                            <strong>${escapeHtml(r.client_name) || 'Anonymous'}</strong>
                            <div>${stars}</div>
                        </div>
                        <p style="font-size:0.88rem;color:var(--text-muted);margin-bottom:12px;">"${escapeHtml(r.comment)}"</p>
                        <div style="display:flex;justify-content:space-between;align-items:center;">
                            <small style="color:var(--text-muted);">${r.created_at?.toDate().toLocaleDateString() || ''}</small>
                            <button onclick="window.deleteReview('${doc.id}')" style="background:none;border:none;color:#ff4444;cursor:pointer;" title="Delete">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    </div>`;
            });
        }
    } catch (error) {
        console.error("Admin error:", error);
        if (unassignedContainer) unassignedContainer.innerHTML = `<p style="color:#ff4444;">Error: ${error.message}</p>`;
    }
}

window.updateUserRole = async function(uid, newRole) {
    if (!confirm(`Change role to ${newRole}?`)) return;
    try {
        // SEGURANÇA ZERO-COST: atualizar diretamente em vez de Cloud Function
        await db.collection('users').doc(uid).update({ role: newRole });
        alert("Role updated!");
        loadAdminDashboard();
    } catch (e) { alert("Error [" + (e.code || "?") + "]: " + e.message); }
};

window.deleteReview = async function(reviewId) {
    if (!confirm("Delete this review?")) return;
    try {
        // SEGURANÇA ZERO-COST: eliminar diretamente em vez de Cloud Function
        await db.collection('reviews').doc(reviewId).delete();
        loadAdminDashboard();
    } catch (e) { alert("Error [" + (e.code || "?") + "]: " + e.message); }
};

window.assignDriverAndCar = async function(bookingId) {
    const driverSelect = document.querySelector(`select.assign-driver-select[data-booking="${bookingId}"]`);
    const carSelect = document.querySelector(`select.assign-car-select[data-booking="${bookingId}"]`);
    const driverId = driverSelect?.value || '';
    const carId = carSelect?.value || '';

    if (!driverId || !carId) {
        alert(window.t('assign_both_required'));
        return;
    }

    try {
        const bookingDoc = await db.collection('bookings').doc(bookingId).get();
        if (!bookingDoc.exists) { alert("Booking not found."); return; }
        const booking = bookingDoc.data();

        // Validação de tipo e capacidade do veículo
        if (carId) {
            const carDoc = await db.collection('cars').doc(carId).get();
            if (carDoc.exists) {
                const car = carDoc.data();
                const carType = car.type;
                const bookingVehicle = booking.vehicle || '';
                const typeLabels = {comfort_sedan:'Comfort Sedan',business_sedan:'Business Sedan',mpv:'MPV',van:'Van'};

                // Verificar se o tipo de carro pode servir a reserva (validação hierárquica)
                if (bookingVehicle && carType !== bookingVehicle) {
                    if (!canServeBooking(carType, bookingVehicle)) {
                        const requestedLabel = typeLabels[bookingVehicle] || bookingVehicle;
                        const assignedLabel = typeLabels[carType] || carType;
                        alert(`️ VEHICLE TYPE TOO SMALL:\n\n` +
                            `Client requested: ${requestedLabel}\n` +
                            `Selected car: ${car.name} (${assignedLabel})\n\n` +
                            `A ${assignedLabel} cannot serve a ${requestedLabel} booking.\n` +
                            `Please select an equal or larger vehicle type.`);
                        return;
                    }
                    // Veículo superior — confirmar com admin
                    const requestedLabel = typeLabels[bookingVehicle] || bookingVehicle;
                    const assignedLabel = typeLabels[carType] || carType;
                    if (!confirm(
                        `ℹ️ VEHICLE UPGRADE:\n\n` +
                        `Client requested: ${requestedLabel}\n` +
                        `Selected car: ${car.name} (${assignedLabel})\n\n` +
                        `The ${assignedLabel} is larger than requested.\n` +
                        `Do you want to continue?`
                    )) return;
                }

                // Verificar se o carro tem capacidade suficiente
                const cfg = VEHICLE_CONFIG[carType];
                if (cfg) {
                    const bookingPax = booking.passengers || 1;
                    const carryOn = booking.carryOnBags || 0;
                    const checked = booking.checkedBags || 0;
                    const luggage = booking.luggage || 0;
                    const lugPoints = carryOn + (checked * 2);
                    if (bookingPax > cfg.maxPax || lugPoints > cfg.maxLugPoints) {
                        const carTypeLabel = typeLabels[carType] || carType;
                        alert(`️ CAPACITY EXCEEDED:\n\n` +
                            `This booking needs ${bookingPax} passengers and ${lugPoints} luggage points.\n` +
                            `${car.name} (${carTypeLabel}) supports max ${cfg.maxPax} passengers and ${cfg.maxLugPoints} luggage points.\n\n` +
                            `Please select a larger vehicle.`);
                        return;
                    }
                }
            }
        }

        // Verificar conflitos de agenda
        if (driverId) {
            const conflict = await checkScheduleConflict(
                driverId, null,
                booking.pickup_datetime,
                booking.pickup, booking.destination,
                bookingId
            );
            if (!conflict.allowed) {
                alert("️ SCHEDULE CONFLICT (Driver):\n\n" + conflict.reason + "\n\nAssignment blocked.");
                return;
            }
        }
        if (carId) {
            const conflict = await checkScheduleConflict(
                null, carId,
                booking.pickup_datetime,
                booking.pickup, booking.destination,
                bookingId
            );
            if (!conflict.allowed) {
                alert("️ SCHEDULE CONFLICT (Car):\n\n" + conflict.reason + "\n\nAssignment blocked.");
                return;
            }
        }

        // Construir dados de atualização
        const updateData = {};
        if (driverId) {
            updateData.driver_id = driverId;
            try {
                const driverDoc = await db.collection('users').doc(driverId).get();
                if (driverDoc.exists) updateData.driver_name = driverDoc.data().full_name || '';
            } catch(e) { /* não crítico */ }
        }
        if (carId) {
            updateData.car_id = carId;
            try {
                const carDoc = await db.collection('cars').doc(carId).get();
                if (carDoc.exists) updateData.car_name = carDoc.data().name || '';
            } catch(e) { /* não crítico */ }
        }
        updateData.status = 'assigned';

        await db.collection('bookings').doc(bookingId).update(updateData);
        alert("Assignment saved successfully!");
        loadAdminDashboard();
    } catch (e) { alert("Error [" + (e.code || "?") + "]: " + e.message); }
};

/* =========================================================
   GESTÃO DE CARROS (Frota)
   ========================================================= */
window.addCar = async function() {
    const name = document.getElementById('car-name-input')?.value.trim();
    const plate = document.getElementById('car-plate-input')?.value.trim().toUpperCase();
    const type = document.getElementById('car-type-select')?.value;
    const color = document.getElementById('car-color-input')?.value.trim();
    const notes = document.getElementById('car-notes-input')?.value.trim();

    if (!name || !plate || !type) {
        alert("Please fill in Car Name, License Plate, and Vehicle Type.");
        return;
    }

    if (!db) {
        alert("Error: Database not initialized. The Firestore database may not be enabled in your Firebase project. Go to Firebase Console > Firestore Database > Create Database.");
        return;
    }

    try {
        await db.collection('cars').add({
            name, plate, type, color: color || '', notes: notes || '',
            active: true,
            created_at: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert("Car added to fleet!");
        // Limpar formulário
        ['car-name-input','car-plate-input','car-color-input','car-notes-input'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        document.getElementById('car-type-select').value = '';
        loadCars();
    } catch (e) { alert("Error [" + (e.code || "?") + "]: " + e.message); }
};

window.loadCars = async function() {
    const grid = document.getElementById('cars-grid');
    if (!grid) return;
    if (!db) { grid.innerHTML = '<p style="color:#ff4444;">Error: Database not initialized.</p>'; return; }

    try {
        const snap = await db.collection('cars').orderBy('created_at', 'desc').get();
        if (snap.empty) {
            grid.innerHTML = '<p class="empty-bookings">No cars in fleet. Add one above.</p>';
            return;
        }

        grid.innerHTML = '';
        snap.forEach(doc => {
            const c = doc.data();
            const typeLabel = {
                comfort_sedan: 'Comfort Sedan', business_sedan: 'Business Sedan',
                mpv: 'MPV', van: 'Van'
            }[c.type] || c.type;

            const statusIcon = c.active
                ? '<i class="fa-solid fa-circle-check" style="color:#2ecc71;"></i>'
                : '<i class="fa-solid fa-circle-xmark" style="color:#ff4444;"></i>';
            const statusText = c.active ? 'Active' : 'Inactive';
            const toggleLabel = c.active ? 'Deactivate' : 'Activate';
            const toggleCls = c.active ? 'btn-cancel-small' : 'btn-submit';
            const toggleStyle = c.active ? '' : 'padding:6px 12px;font-size:0.75rem;width:auto;margin-top:0;background:#2ecc71;';

            grid.innerHTML += `
                <div class="car-card" id="car-${doc.id}">
                    <div class="car-card-header">
                        <strong>${escapeHtml(c.name)}</strong>
                        <span class="car-plate">${escapeHtml(c.plate)}</span>
                    </div>
                    <div class="car-card-details">
                        <span>${typeLabel}</span>
                        ${c.color ? `<span>• ${escapeHtml(c.color)}</span>` : ''}
                        ${c.notes ? `<br><small style="color:var(--text-muted);">${escapeHtml(c.notes)}</small>` : ''}
                    </div>
                    <div class="car-card-status">
                        ${statusIcon} ${statusText}
                    </div>
                    <div class="car-card-actions">
                        <button class="btn-notes" onclick="window.editCarNotes('${doc.id}', '${escapeHtml(c.notes || '').replace(/'/g, "\\'")}')">
                            <i class="fa-solid fa-pen-to-square"></i> Notes
                        </button>
                        <button class="${toggleCls}" style="${toggleStyle}" onclick="window.toggleCarActive('${doc.id}', ${!c.active})">
                            ${toggleLabel}
                        </button>
                        <button class="btn-cancel-small" onclick="window.deleteCar('${doc.id}')">
                            <i class="fa-solid fa-trash-can"></i> Delete
                        </button>
                    </div>
                </div>`;
        });
    } catch (e) {
        console.error("Error loading cars:", e);
        grid.innerHTML = `<p style="color:#ff4444;">Error: ${e.message}</p>`;
    }
};

window.toggleCarActive = async function(carId, active) {
    try {
        await db.collection('cars').doc(carId).update({ active });
        loadCars();
    } catch (e) { alert("Error [" + (e.code || "?") + "]: " + e.message); }
};

window.deleteCar = async function(carId) {
    if (!confirm("Delete this car from the fleet?")) return;
    try {
        await db.collection('cars').doc(carId).delete();
        loadCars();
    } catch (e) { alert("Error [" + (e.code || "?") + "]: " + e.message); }
};

window.editCarNotes = function(carId, currentNotes) {
    const modal = document.getElementById('editNotesModal');
    if (!modal) return;
    document.getElementById('edit-notes-car-id').value = carId;
    document.getElementById('edit-notes-textarea').value = currentNotes || '';
    modal.classList.add('show');
};

window.closeEditNotesModal = function() {
    const modal = document.getElementById('editNotesModal');
    if (modal) modal.classList.remove('show');
};

window.saveCarNotes = async function() {
    const carId = document.getElementById('edit-notes-car-id')?.value;
    const notes = document.getElementById('edit-notes-textarea')?.value.trim() || '';
    if (!carId) return;
    try {
        await db.collection('cars').doc(carId).update({ notes });
        window.closeEditNotesModal();
        loadCars();
    } catch (e) { alert("Error [" + (e.code || "?") + "]: " + e.message); }
};

/* =========================================================
   INICIALIZAÇÃO DA PÁGINA
   ========================================================= */
function initAdminPage(user) {
    loadAdminDashboard();
    loadCars();
    const path = window.location.pathname;
    if (path.includes('admin')) window.renderCalendar('admin');
    if (path.includes('cars')) window.renderCalendar('admin');
}

window.registerPageInit('admin', initAdminPage);
window.registerPageInit('cars', initAdminPage);
