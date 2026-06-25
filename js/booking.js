/* =========================================================
   MAPA
   ========================================================= */
let map, pickupMarker, destMarker, routeLine;

function initMap() {
    const mapContainer = document.getElementById('map');
    if (!mapContainer || map) return;

    // Usar o elemento de mapa no formulário (class map-in-form, id="map")
    map = L.map('map', { zoomControl: true, attributionControl: false }).setView([37.0176, -7.9304], 9);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO'
    }).addTo(map);

    const pickupInput = document.getElementById('pickup-input');
    const destInput = document.getElementById('dest-input');
    if (pickupInput) pickupInput.addEventListener('change', updateRoute);
    if (destInput) destInput.addEventListener('change', updateRoute);
}

async function updateRoute() {
    const pLoc = document.getElementById('pickup-input')?.value;
    const dLoc = document.getElementById('dest-input')?.value;
    const pCoord = await geocode(pLoc);
    const dCoord = await geocode(dLoc);

    if (pCoord) {
        if (pickupMarker) map.removeLayer(pickupMarker);
        pickupMarker = L.marker(pCoord).addTo(map).bindPopup("Pickup").openPopup();
    }
    if (dCoord) {
        if (destMarker) map.removeLayer(destMarker);
        destMarker = L.marker(dCoord).addTo(map).bindPopup("Destination");
    }
    if (pCoord && dCoord) {
        if (routeLine) map.removeLayer(routeLine);
        let routeDrawn = false;
        try {
            const url = `https://router.project-osrm.org/route/v1/driving/${pCoord[1]},${pCoord[0]};${dCoord[1]},${dCoord[0]}?overview=full&geometries=geojson`;
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
                    const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
                    routeLine = L.polyline(coords, { color: '#d4af37', weight: 4, opacity: 0.8 }).addTo(map);
                    routeDrawn = true;
                }
            }
        } catch (e) { console.warn("OSRM route geometry unavailable, using straight line"); }
        // Alternativa: linha reta
        if (!routeDrawn) {
            routeLine = L.polyline([pCoord, dCoord], { color: '#d4af37', weight: 4, opacity: 0.8, dashArray: '10, 8' }).addTo(map);
        }
        map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
    } else if (pCoord) {
        map.setView(pCoord, 13);
    } else if (dCoord) {
        map.setView(dCoord, 13);
    }
}

/* =========================================================
   OPÇÕES DO FORMULÁRIO E CAPACIDADE
   ========================================================= */
window.toggleOption = function(clickedBtn) {
    const parent = clickedBtn.parentElement;
    parent.querySelectorAll('.option-btn').forEach(btn => btn.classList.remove('active'));
    clickedBtn.classList.add('active');
    if (parent.id === 'vehicle-select') checkCapacity();
};

window.toggleFlightNumber = function(show) {
    const g = document.getElementById('flight-number-group');
    if (g) g.style.display = show ? 'block' : 'none';
};

window.changeValue = function(id, delta) {
    const input = document.getElementById(id);
    if (!input) return;
    const cfg = getVehicleConfig();
    const maxPax = cfg.maxPax;
    const maxLugPoints = cfg.maxLugPoints;

    let val = parseInt(input.value) || 0;
    val += delta;
    if (val < parseInt(input.min)) val = parseInt(input.min);

    // Crianças não podem exceder total de passageiros menos 1 (pelo menos 1 adulto)
    if (id === 'children-input') {
        const paxVal = parseInt(document.getElementById('pax-input')?.value) || 1;
        if (val > paxVal - 1) val = Math.max(0, paxVal - 1);
        input.value = val;
        const notice = document.getElementById('children-notice');
        if (notice) notice.classList.toggle('show', val > 0);
        return;
    }

    // Verificação de capacidade de bagagem (mão=1pt, porão=2pts)
    if (id.includes('bags') || id.includes('carry-on')) {
        const cVal  = id === 'carry-on-input'    ? val : (parseInt(document.getElementById('carry-on-input')?.value) || 0);
        const chVal = id === 'checked-bags-input' ? val : (parseInt(document.getElementById('checked-bags-input')?.value) || 0);
        const totalPoints = cVal + (chVal * 2);
        if (totalPoints > maxLugPoints) {
            const bubble = document.getElementById('pax-bags-bubble');
            if (bubble) {
                bubble.textContent = `Max ${maxLugPoints} luggage points (checked = 2 pts, carry-on = 1 pt)`;
                bubble.classList.add('show');
                setTimeout(() => bubble.classList.remove('show'), 3500);
            }
            return;
        }
    } else {
        if (val > maxPax) val = maxPax;
    }

    input.value = val;
    checkCapacity();

    // Se passageiros diminuírem, ajustar crianças para passageiros - 1
    if (id === 'pax-input') {
        const childrenInput = document.getElementById('children-input');
        if (childrenInput) {
            const childrenVal = parseInt(childrenInput.value) || 0;
            if (childrenVal >= val) {
                childrenInput.value = Math.max(0, val - 1);
                const notice = document.getElementById('children-notice');
                if (notice) notice.classList.toggle('show', (val - 1) > 0);
            }
        }
    }
};

function checkCapacity() {
    const paxInput = document.getElementById('pax-input');
    const cInput    = document.getElementById('carry-on-input');
    const chInput   = document.getElementById('checked-bags-input');
    const childrenInput = document.getElementById('children-input');

    let pax     = parseInt(paxInput?.value) || 1;
    let cVal    = parseInt(cInput?.value) || 0;
    let chVal   = parseInt(chInput?.value) || 0;
    let totalPoints = cVal + (chVal * 2);

    const cfg = getVehicleConfig();
    const maxPax = cfg.maxPax;
    const maxLugPoints = cfg.maxLugPoints;

    // Ajustar passageiros automaticamente
    if (pax > maxPax) {
        pax = maxPax;
        if (paxInput) paxInput.value = pax;
    }
    if (paxInput) paxInput.max = maxPax;

    // Ajustar crianças automaticamente para passageiros - 1
    if (childrenInput) {
        const children = parseInt(childrenInput.value) || 0;
        if (children >= pax) {
            const newChildren = Math.max(0, pax - 1);
            childrenInput.value = newChildren;
            const notice = document.getElementById('children-notice');
            if (notice) notice.classList.toggle('show', newChildren > 0);
        }
    }

    // Ajustar bagagem automaticamente (reduzir porão primeiro, depois mão)
    if (totalPoints > maxLugPoints) {
        let excess = totalPoints - maxLugPoints;
        // Reduzir bagagens de porão primeiro (2 pts cada)
        while (chVal > 0 && excess >= 2) {
            chVal--;
            excess -= 2;
        }
        // Depois reduzir bagagens de mão (1 pt cada)
        while (cVal > 0 && excess >= 1) {
            cVal--;
            excess -= 1;
        }
        if (cInput) cInput.value = cVal;
        if (chInput) chInput.value = chVal;
        totalPoints = cVal + (chVal * 2);
    }

    const warning = document.getElementById('capacity-warning');
    if (warning) warning.classList.toggle('hidden', pax <= maxPax && totalPoints <= maxLugPoints);
}

/* =========================================================
   SUBMISSÃO DA RESERVA
   ========================================================= */
let _pendingBookingData = null;

function setupBookingForm() {
    const bookBtn = document.getElementById('book-btn');
    if (!bookBtn) return;

    bookBtn.addEventListener('click', () => {
        if (!auth.currentUser) { alert("Please log in first."); return; }

        const travelStatus = document.querySelector('#status-select .option-btn.active')?.textContent.trim();
        const vehicleKey = document.querySelector('#vehicle-select .option-btn.active')?.dataset?.vehicleKey || 'comfort_sedan';
        const vehicleName = document.querySelector('#vehicle-select .option-btn.active .vehicle-name')?.textContent.trim();
        const leadPassenger = document.getElementById('lead-passenger-input').value.trim();
        const dialCode = document.getElementById('hidden-dial-code')?.value || "";
        const phoneVal = document.getElementById('phone-number-input').value.trim();
        const phoneNumber = `${dialCode} ${phoneVal}`.trim();
        const flightNumber = document.getElementById('flight-number-input')?.value.trim() || "";
        const pickup = document.getElementById('pickup-input').value.trim();
        const destination = document.getElementById('dest-input').value.trim();
        const date = document.getElementById('date-input').value;
        const time = document.getElementById('time-input').value;
        const pax = parseInt(document.getElementById('pax-input')?.value) || 1;
        const children = parseInt(document.getElementById('children-input')?.value) || 0;
        const carryOn = parseInt(document.getElementById('carry-on-input')?.value) || 0;
        const checkedBags = parseInt(document.getElementById('checked-bags-input')?.value) || 0;
        const notes = document.getElementById('notes-input')?.value.trim() || "";

        if (!pickup || !destination || !date || !time || !leadPassenger || !phoneVal) {
            alert("Please fill in Lead Passenger, Phone, Pickup, Destination, Date and Time.");
            return;
        }

        const pickupDateTime = new Date(`${date}T${time}:00`);
        if (isNaN(pickupDateTime.getTime())) { alert("Invalid date or time."); return; }

        // Verificação de capacidade
        const cfg = getVehicleConfig();
        const lugPoints = carryOn + (checkedBags * 2);
        if (pax > cfg.maxPax || lugPoints > cfg.maxLugPoints) {
            alert(window.t('capacity_exceeded'));
            return;
        }

        // Validação de crianças: pelo menos 1 adulto obrigatório
        if (children >= pax) {
            alert("At least 1 adult must be included in the total passengers.");
            return;
        }

        // Notas sobre crianças obrigatórias
        if (children > 0 && !notes) {
            alert("Please specify children's ages and required seat types in the Notes field.");
            document.getElementById('notes-input')?.focus();
            return;
        }

        // Limitação de taxa (esforço do lado do cliente): máx. 5 reservas por hora
        try {
            const now = Date.now();
            const hour = 60 * 60 * 1000;
            let bookingTimes = JSON.parse(localStorage.getItem('vs_booking_times') || '[]');
            bookingTimes = bookingTimes.filter(t => now - t < hour);
            if (bookingTimes.length >= 5) {
                alert("Too many booking attempts. Please try again later.");
                return;
            }
            bookingTimes.push(now);
            localStorage.setItem('vs_booking_times', JSON.stringify(bookingTimes));
        } catch (e) { /* ignore localStorage errors */ }

        // Guardar dados validados para executeBooking()
        const luggage = carryOn + (checkedBags * 2);

        _pendingBookingData = {
            travelStatus, vehicle: vehicleKey, vehicleName,
            leadPassenger, phoneNumber, flightNumber: flightNumber || "",
            pickup, destination,
            pickup_datetime: firebase.firestore.Timestamp.fromDate(pickupDateTime),
            passengers: pax, children,
            carryOnBags: carryOn, checkedBags, luggage, notes: notes || "",
            client_id: auth.currentUser.uid,
            client_name: auth.currentUser.displayName || "Guest",
            status: 'pending',
            created_at: firebase.firestore.FieldValue.serverTimestamp()
        };

        window.openPaymentModal();
    });
}

window.openPaymentModal = function() {
    const modal = document.getElementById('paymentModal');
    if (modal) modal.classList.add('show');
};

window.closePaymentModal = function() {
    const modal = document.getElementById('paymentModal');
    if (modal) modal.classList.remove('show');
};

window.executeBooking = async function() {
    if (!_pendingBookingData) return;
    const confirmBtn = document.getElementById('payment-confirm-btn');
    if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = '...'; }
    try {
        // SEGURANÇA ZERO-COST: escrever diretamente no Firestore em vez de Cloud Function
        await db.collection('bookings').add(_pendingBookingData);
        _pendingBookingData = null;
        window.closePaymentModal();
        alert(window.t('booking_success') || "Booking confirmed!");

        // Limpar marcadores do mapa
        if (map) {
            if (pickupMarker) { map.removeLayer(pickupMarker); pickupMarker = null; }
            if (destMarker) { map.removeLayer(destMarker); destMarker = null; }
            if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
        }

        // Repor campos do formulário
        ['lead-passenger-input','phone-number-input','flight-number-input','pickup-input','dest-input','notes-input','date-input','time-input'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        const paxInput = document.getElementById('pax-input');
        if (paxInput) paxInput.value = 1;
        ['children-input','carry-on-input','checked-bags-input'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = 0;
        });
        const notice = document.getElementById('children-notice');
        if (notice) notice.classList.remove('show');

    } catch (error) {
        console.error("Booking error:", error);
        alert("Error [" + (error.code || "?") + "]: " + error.message);
    } finally {
        if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = window.t('payment_confirm') || 'Pay'; }
    }
};

window.addEventListener('click', (e) => {
    const pm = document.getElementById('paymentModal');
    if (e.target === pm) window.closePaymentModal();
});

/* =========================================================
   MENU DE CÓDIGO TELEFÓNICO
   ========================================================= */
const countries = [
    { name: "Afghanistan", code: "AF", dial: "+93", placeholder: "70 123 4567" },
    { name: "Albania", code: "AL", dial: "+355", placeholder: "67 123 4567" },
    { name: "Algeria", code: "DZ", dial: "+213", placeholder: "512 34 56 78" },
    { name: "Angola", code: "AO", dial: "+244", placeholder: "912 345 678" },
    { name: "Argentina", code: "AR", dial: "+54", placeholder: "9 11 1234-5678" },
    { name: "Australia", code: "AU", dial: "+61", placeholder: "412 345 678" },
    { name: "Austria", code: "AT", dial: "+43", placeholder: "664 1234567" },
    { name: "Belgium", code: "BE", dial: "+32", placeholder: "412 34 56 78" },
    { name: "Brazil", code: "BR", dial: "+55", placeholder: "11 91234-5678" },
    { name: "Bulgaria", code: "BG", dial: "+359", placeholder: "87 123 4567" },
    { name: "Canada", code: "CA", dial: "+1", placeholder: "613-555-0123" },
    { name: "Chile", code: "CL", dial: "+56", placeholder: "9 1234 5678" },
    { name: "China", code: "CN", dial: "+86", placeholder: "131 1234 5678" },
    { name: "Colombia", code: "CO", dial: "+57", placeholder: "312 3456789" },
    { name: "Croatia", code: "HR", dial: "+385", placeholder: "91 123 4567" },
    { name: "Czech Republic", code: "CZ", dial: "+420", placeholder: "123 456 789" },
    { name: "Denmark", code: "DK", dial: "+45", placeholder: "12 34 56 78" },
    { name: "Egypt", code: "EG", dial: "+20", placeholder: "101 234 5678" },
    { name: "Finland", code: "FI", dial: "+358", placeholder: "41 123 4567" },
    { name: "France", code: "FR", dial: "+33", placeholder: "6 12 34 56 78" },
    { name: "Germany", code: "DE", dial: "+49", placeholder: "151 12345678" },
    { name: "Greece", code: "GR", dial: "+30", placeholder: "691 234 5678" },
    { name: "Hungary", code: "HU", dial: "+36", placeholder: "20 123 4567" },
    { name: "India", code: "IN", dial: "+91", placeholder: "91234 56789" },
    { name: "Indonesia", code: "ID", dial: "+62", placeholder: "812-3456-7890" },
    { name: "Ireland", code: "IE", dial: "+353", placeholder: "83 123 4567" },
    { name: "Israel", code: "IL", dial: "+972", placeholder: "51-234-5678" },
    { name: "Italy", code: "IT", dial: "+39", placeholder: "312 345 6789" },
    { name: "Japan", code: "JP", dial: "+81", placeholder: "90-1234-5678" },
    { name: "Jordan", code: "JO", dial: "+962", placeholder: "7 1234 5678" },
    { name: "Kuwait", code: "KW", dial: "+965", placeholder: "1234 5678" },
    { name: "Malaysia", code: "MY", dial: "+60", placeholder: "12-345 6789" },
    { name: "Mexico", code: "MX", dial: "+52", placeholder: "1 123 456 7890" },
    { name: "Morocco", code: "MA", dial: "+212", placeholder: "612-345678" },
    { name: "Netherlands", code: "NL", dial: "+31", placeholder: "6 12345678" },
    { name: "New Zealand", code: "NZ", dial: "+64", placeholder: "21 123 4567" },
    { name: "Nigeria", code: "NG", dial: "+234", placeholder: "803 123 4567" },
    { name: "Norway", code: "NO", dial: "+47", placeholder: "123 45 678" },
    { name: "Pakistan", code: "PK", dial: "+92", placeholder: "312 3456789" },
    { name: "Peru", code: "PE", dial: "+51", placeholder: "912 345 678" },
    { name: "Philippines", code: "PH", dial: "+63", placeholder: "912 345 6789" },
    { name: "Poland", code: "PL", dial: "+48", placeholder: "123 456 789" },
    { name: "Portugal", code: "PT", dial: "+351", placeholder: "912 345 678" },
    { name: "Qatar", code: "QA", dial: "+974", placeholder: "3123 4567" },
    { name: "Romania", code: "RO", dial: "+40", placeholder: "712 345 678" },
    { name: "Russia", code: "RU", dial: "+7", placeholder: "912 345-67-89" },
    { name: "Saudi Arabia", code: "SA", dial: "+966", placeholder: "51 234 5678" },
    { name: "Singapore", code: "SG", dial: "+65", placeholder: "8123 4567" },
    { name: "Slovakia", code: "SK", dial: "+421", placeholder: "912 345 678" },
    { name: "South Africa", code: "ZA", dial: "+27", placeholder: "12 345 6789" },
    { name: "Spain", code: "ES", dial: "+34", placeholder: "612 34 56 78" },
    { name: "Sri Lanka", code: "LK", dial: "+94", placeholder: "71 234 5678" },
    { name: "Sweden", code: "SE", dial: "+46", placeholder: "71 234 56 78" },
    { name: "Switzerland", code: "CH", dial: "+41", placeholder: "71 234 56 78" },
    { name: "Thailand", code: "TH", dial: "+66", placeholder: "81 234 5678" },
    { name: "Turkey", code: "TR", dial: "+90", placeholder: "512 345 67 89" },
    { name: "Ukraine", code: "UA", dial: "+380", placeholder: "44 123 4567" },
    { name: "United Arab Emirates", code: "AE", dial: "+971", placeholder: "50 123 4567" },
    { name: "United Kingdom", code: "GB", dial: "+44", placeholder: "7123 456789" },
    { name: "United States", code: "US", dial: "+1", placeholder: "202-555-0123" },
    { name: "Venezuela", code: "VE", dial: "+58", placeholder: "212 123 4567" },
    { name: "Vietnam", code: "VN", dial: "+84", placeholder: "123 456 789" }
];

window.setupDialCodeDropdown = function() {
    const searchInput = document.getElementById('dial-search-input');
    const container = document.getElementById('dial-code-container');
    if (!searchInput) return;

    renderDialList(countries);

    searchInput.addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase();
        renderDialList(countries.filter(c =>
            c.name.toLowerCase().includes(val) || c.dial.includes(val) || c.code.toLowerCase().includes(val)
        ));
    });

    document.addEventListener('click', (e) => {
        if (container && !container.contains(e.target)) {
            const dd = document.getElementById('dial-dropdown');
            if (dd) dd.classList.remove('show');
        }
    });
};

function renderDialList(list) {
    const listBox = document.getElementById('dial-list');
    if (!listBox) return;
    listBox.innerHTML = '';
    list.forEach(country => {
        const li = document.createElement('li');
        li.className = 'dial-item';
        li.innerHTML = `
            <img src="https://flagcdn.com/w20/${country.code.toLowerCase()}.png" alt="${country.code}">
            <span class="country-name">${country.name}</span>
            <span class="dial-value">${country.dial}</span>`;
        li.onclick = () => selectDialCode(country);
        listBox.appendChild(li);
    });
}

function selectDialCode(country) {
    const flagImg = document.getElementById('selected-flag');
    const dialSpan = document.getElementById('selected-dial-code');
    const hiddenDial = document.getElementById('hidden-dial-code');
    const phoneInput = document.getElementById('phone-number-input');

    if (flagImg) flagImg.src = `https://flagcdn.com/w20/${country.code.toLowerCase()}.png`;
    if (dialSpan) dialSpan.textContent = country.dial;
    if (hiddenDial) hiddenDial.value = country.dial;
    if (phoneInput) { phoneInput.placeholder = country.placeholder || "912 345 678"; phoneInput.focus(); }

    const dd = document.getElementById('dial-dropdown');
    if (dd) dd.classList.remove('show');
}

window.toggleDialDropdown = function() {
    const dd = document.getElementById('dial-dropdown');
    if (!dd) return;
    dd.classList.toggle('show');
    if (dd.classList.contains('show')) {
        const s = document.getElementById('dial-search-input');
        if (s) s.focus();
    }
};

/* =========================================================
   INICIALIZAÇÃO DA PÁGINA
   ========================================================= */
function initBookingPage(user) {
    initMap();
    setupBookingForm();
    if (document.getElementById('dial-search-input')) setupDialCodeDropdown();
    const phoneInput = document.getElementById('phone-number-input');
    if (phoneInput) phoneInput.addEventListener('input', e => { e.target.value = e.target.value.replace(/[^0-9]/g, ''); });
}

window.registerPageInit('booking', initBookingPage);
