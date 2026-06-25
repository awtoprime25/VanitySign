/* =========================================================
   Inicialização do Firebase
   ========================================================= */
let db, auth;

if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    // Algumas redes (proxies, VPNs, antivírus, extensões do navegador) quebram o transporte
    // padrão de streaming WebChannel do Firestore, o que se manifesta como erros
    // `internal`/`unavailable` em escritas enquanto as leituras ainda funcionam. A deteção
    // automática de long-polling evita isso.
    // Deve ser executado antes da primeira leitura/escrita do Firestore (todo o resto é executado mais tarde, de forma assíncrona).
    try { db.settings({ experimentalAutoDetectLongPolling: true, merge: true }); } catch (e) {}
    auth = firebase.auth();
    // Tornar db e auth acessíveis globalmente
    window.db = db;
    window.auth = auth;
} else {
    console.error("Firebase SDK failed to load. Database and authentication will not work.");
}

/* =========================================================
   Sistema de Tradução i18n
   ========================================================= */
let currentLang = localStorage.getItem('lang') || 'en';
let i18nData = {};

// Chamado após cada mudança de idioma para re-renderizar conteúdo JS dinâmico.
// As páginas registam a sua função de recarga aqui para que os badges de estado e botões sejam atualizados.
window._onLangChange = null;

window.changeLanguage = async function(lang) {
    try {
        const response = await fetch(`locales/${lang}.json`);
        i18nData = await response.json();
        currentLang = lang;
        localStorage.setItem('lang', lang);
        translatePage();
        // Re-renderizar qualquer conteúdo JS dinâmico que usou window.t() no momento da renderização
        if (typeof window._onLangChange === 'function') window._onLangChange();
    } catch (error) {
        console.error("Failed to load translation:", error);
    }
};

window.t = function(key, variables = {}) {
    let text = i18nData[key] || key;
    Object.keys(variables).forEach(v => {
        text = text.replace(`{{${v}}}`, variables[v]);
    });
    return text;
};

function translatePage() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = window.t(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(input => {
        const key = input.getAttribute('data-i18n-placeholder');
        input.placeholder = window.t(key);
    });
}

const i18nObserver = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) {
                if (node.hasAttribute('data-i18n')) {
                    node.textContent = window.t(node.getAttribute('data-i18n'));
                }
                node.querySelectorAll('[data-i18n]').forEach(el => {
                    el.textContent = window.t(el.getAttribute('data-i18n'));
                });
            }
        });
    });
});
i18nObserver.observe(document.body, { childList: true, subtree: true });

/* =========================================================
   Configuração de Veículos
   maxPax        = máx. passageiros (motorista NÃO contado)
   maxLugPoints  = bagagem de mão = 1 pt, bagagem despachada = 2 pts
   pricePerKm    = interno apenas, nunca mostrado ao cliente
   ========================================================= */
const VEHICLE_CONFIG = {
  comfort_sedan: { maxPax: 4, maxLugPoints: 4, rank: 1 },
  business_sedan:{ maxPax: 4, maxLugPoints: 4, rank: 2 },
  mpv: { maxPax: 5, maxLugPoints: 5, rank: 3 },
  van: { maxPax: 8, maxLugPoints: 8, rank: 4 },
};

// ComfortSedan < BusinessSedan < MPV < Van
// Categoria superior pode atender reservas de categoria inferior
function canServeBooking(carType, bookingVehicle) {
    if (!VEHICLE_CONFIG[carType] || !VEHICLE_CONFIG[bookingVehicle]) return true;
    return VEHICLE_CONFIG[carType].rank >= VEHICLE_CONFIG[bookingVehicle].rank;
}

function getVehicleConfig() {
    const key = document.querySelector('#vehicle-select .option-btn.active')?.dataset?.vehicleKey;
    return VEHICLE_CONFIG[key] || { maxPax: 4, maxLugPoints: 4 };
}

/* =========================================================
   Agendamento e Deteção de Conflitos
   ========================================================= */
const ROAD_MULTIPLIER = 1.35;

// Distância Haversine em km entre dois pontos [lat, lon]
function haversineDistance(coord1, coord2) {
    const R = 6371; // Raio da Terra em km
    const toRad = deg => deg * Math.PI / 180;
    const dLat = toRad(coord2[0] - coord1[0]);
    const dLon = toRad(coord2[1] - coord1[1]);
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(coord1[0])) * Math.cos(toRad(coord2[0])) *
              Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Velocidade média dinâmica: rotas curtas = mais lento (estradas nacionais), longas = mais rápido (autoestrada)
function dynamicAvgSpeed(roadKm) {
    return Math.min(110, Math.max(60, 60 + roadKm * 0.15));
}

// Cache de informações de rota: "lat1,lon1;lat2,lon2" -> { distanceKm, durationMin, source }
const _routeCache = {};

// Obter informações de rota via OSRM (tempo real de condução) com alternativa de velocidade dinâmica
async function getRouteInfo(fromCoord, toCoord) {
    if (!fromCoord || !toCoord) return { distanceKm: 0, durationMin: 0, source: 'none' };

    const cacheKey = `${fromCoord[0].toFixed(4)},${fromCoord[1].toFixed(4)};${toCoord[0].toFixed(4)},${toCoord[1].toFixed(4)}`;
    if (_routeCache[cacheKey]) return _routeCache[cacheKey];

    // Tentar OSRM
    try {
        const url = `https://router.project-osrm.org/route/v1/driving/${fromCoord[1]},${fromCoord[0]};${toCoord[1]},${toCoord[0]}?overview=false`;
        const response = await fetch(url);
        if (response.ok) {
            const data = await response.json();
            if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
                const result = {
                    distanceKm: data.routes[0].distance / 1000,
                    durationMin: Math.ceil(data.routes[0].duration / 60),
                    source: 'osrm'
                };
                _routeCache[cacheKey] = result;
                return result;
            }
        }
    } catch (e) { console.warn("OSRM unavailable, using fallback:", e.message); }

    // Alternativa: haversine + multiplicador de estrada + velocidade dinâmica
    const straightKm = haversineDistance(fromCoord, toCoord);
    const roadKm = straightKm * ROAD_MULTIPLIER;
    const avgSpeed = dynamicAvgSpeed(roadKm);
    const result = {
        distanceKm: roadKm,
        durationMin: Math.ceil((roadKm / avgSpeed) * 60),
        source: 'fallback'
    };
    _routeCache[cacheKey] = result;
    return result;
}

// Estimar tempo de viagem em minutos entre dois pares de coordenadas (assíncrono, usa OSRM)
async function estimateTravelMinutes(fromCoord, toCoord) {
    const info = await getRouteInfo(fromCoord, toCoord);
    return info.durationMin;
}

// Geocodificação via Nominatim
async function geocode(address) {
    if (!address || address.length < 3) return null;
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`);
        const data = await response.json();
        if (data && data.length > 0) return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
    } catch (e) { console.error("Geocoding error", e); }
    return null;
}

// Geocodificação com cache para evitar chamadas de API duplicadas
const _geocodeCache = {};
async function geocodeCached(address) {
    if (!address || address.length < 3) return null;
    const key = address.toLowerCase().trim();
    if (_geocodeCache[key]) return _geocodeCache[key];
    const result = await geocode(address);
    if (result) _geocodeCache[key] = result;
    return result;
}

/**
 * Verificar se a atribuição de motorista/carro a uma reserva conflitua com reservas existentes.
 * Retorna { allowed: boolean, reason: string|null, earliestTime: Date|null }
 */
async function checkScheduleConflict(driverId, carId, pickupDatetime, pickupLocation, destinationLocation, excludeBookingId) {
    const pickupTime = pickupDatetime instanceof Date ? pickupDatetime : pickupDatetime.toDate();

    // Consultar todas as reservas ativas para este motorista ou carro no mesmo dia
    const dayStart = new Date(pickupTime);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(pickupTime);
    dayEnd.setHours(23, 59, 59, 999);

    const dayStartTs = firebase.firestore.Timestamp.fromDate(dayStart);
    const dayEndTs = firebase.firestore.Timestamp.fromDate(dayEnd);

    // Verificar conflitos de motorista
    if (driverId) {
        const driverSnap = await db.collection('bookings')
            .where('driver_id', '==', driverId)
            .where('pickup_datetime', '>=', dayStartTs)
            .where('pickup_datetime', '<=', dayEndTs)
            .get();

        const driverBookings = [];
        driverSnap.forEach(doc => {
            if (doc.id !== excludeBookingId) {
                const status = doc.data().status;
                if (status !== 'completed' && status !== 'no-show' && status !== 'cancelled') {
                    driverBookings.push({ id: doc.id, ...doc.data() });
                }
            }
        });

        // Ordenar por hora de recolha
        driverBookings.sort((a, b) => a.pickup_datetime.toDate() - b.pickup_datetime.toDate());

        // Geocodificar a nova morada de recolha
        const newPickupCoord = await geocodeCached(pickupLocation);

        for (const existing of driverBookings) {
            const existingTime = existing.pickup_datetime.toDate();
            const existingDestCoord = await geocodeCached(existing.destination);
            const existingPickupCoord = await geocodeCached(existing.pickup);

            // Estimar quanto tempo dura a transferência existente (via OSRM ou alternativa)
            let existingDurationMin = 30;
            if (existingDestCoord && existingPickupCoord) {
                const routeInfo = await getRouteInfo(existingPickupCoord, existingDestCoord);
                existingDurationMin = Math.max(30, routeInfo.durationMin);
            }

            const existingEndTime = new Date(existingTime.getTime() + existingDurationMin * 60000);

            // Calcular tempo de viagem do destino existente para a nova recolha
            let travelMinutes = 0;
            if (existingDestCoord && newPickupCoord) {
                travelMinutes = await estimateTravelMinutes(existingDestCoord, newPickupCoord);
            }

            const earliestPossible = new Date(existingEndTime.getTime() + travelMinutes * 60000);

            if (pickupTime < earliestPossible) {
                return {
                    allowed: false,
                    reason: `Driver finishes in ${existing.destination} at ${existingEndTime.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}. With ${travelMinutes}min travel to ${pickupLocation}, earliest available: ${earliestPossible.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`,
                    earliestTime: earliestPossible
                };
            }
        }
    }

    // Verificar conflitos de carro (mesma lógica)
    if (carId) {
        const carSnap = await db.collection('bookings')
            .where('car_id', '==', carId)
            .where('pickup_datetime', '>=', dayStartTs)
            .where('pickup_datetime', '<=', dayEndTs)
            .get();

        const carBookings = [];
        carSnap.forEach(doc => {
            if (doc.id !== excludeBookingId) {
                const status = doc.data().status;
                if (status !== 'completed' && status !== 'no-show' && status !== 'cancelled') {
                    carBookings.push({ id: doc.id, ...doc.data() });
                }
            }
        });

        carBookings.sort((a, b) => a.pickup_datetime.toDate() - b.pickup_datetime.toDate());

        const newPickupCoord = await geocodeCached(pickupLocation);

        for (const existing of carBookings) {
            const existingTime = existing.pickup_datetime.toDate();
            const existingDestCoord = await geocodeCached(existing.destination);
            const existingPickupCoord = await geocodeCached(existing.pickup);

            let existingDurationMin = 30;
            if (existingDestCoord && existingPickupCoord) {
                const routeInfo = await getRouteInfo(existingPickupCoord, existingDestCoord);
                existingDurationMin = Math.max(30, routeInfo.durationMin);
            }

            const existingEndTime = new Date(existingTime.getTime() + existingDurationMin * 60000);

            let travelMinutes = 0;
            if (existingDestCoord && newPickupCoord) {
                travelMinutes = await estimateTravelMinutes(existingDestCoord, newPickupCoord);
            }

            const earliestPossible = new Date(existingEndTime.getTime() + travelMinutes * 60000);

            if (pickupTime < earliestPossible) {
                return {
                    allowed: false,
                    reason: `Car finishes in ${existing.destination} at ${existingEndTime.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}. With ${travelMinutes}min travel to ${pickupLocation}, earliest available: ${earliestPossible.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`,
                    earliestTime: earliestPossible
                };
            }
        }
    }

    return { allowed: true, reason: null, earliestTime: null };
}

/* =========================================================
   Dados das Cidades (apenas imagens; títulos/descrições vêm do i18n)
   ========================================================= */
const cityData = {
    marbella: { images: ["assets/Marbella1.jpg", "assets/Marbella2.jpg", "assets/Marbella3.jpg"] },
    sevilha:  { images: ["assets/Sevilha1.jpg",  "assets/Sevilha2.jpg",  "assets/Sevilha3.jpg"] },
    cordoba:  { images: ["assets/Cordoba1.jpg",  "assets/Cordoba2.jpg",  "assets/Cordoba3.jpg"] },
    malaga:   { images: ["assets/Malaga1.jpg",   "assets/Malaga2.jpg",   "assets/Malaga3.jpg"] },
    lisboa:   { images: ["assets/Lisboa1.jpg",   "assets/Lisboa2.jpg",   "assets/Lisboa3.jpg"] },
    faro:     { images: ["assets/Faro1.jpg",     "assets/Faro2.jpg",     "assets/Faro3.jpg"] },
    vilamoura:{ images: ["assets/Vilamoura1.jpg","assets/Vilamoura2.jpg","assets/Vilamoura3.jpg"] },
    albufeira:{ images: ["assets/Albufeira1.jpg","assets/Albufeira2.jpg","assets/Albufeira3.jpg"] },
    carvoeiro:{ images: ["assets/Carvoeiro1.jpg","assets/Carvoeiro2.jpg","assets/Carvoeiro3.jpg"] }
};

/* =========================================================
   Funções Auxiliares
   ========================================================= */
function toTitleCase(str) {
    if (!str) return "";
    return str.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/**
 * Escapar HTML para prevenir ataques XSS.
 * USE SEMPRE isto ao inserir conteúdo gerado pelo utilizador em innerHTML.
 */
function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

window.handleLogout = async function() {
    try {
        await auth.signOut();
        try { localStorage.removeItem('vs_display_name'); } catch(e) {}
        window.location.href = 'index.html';
    } catch (error) {
        console.error("Logout failed", error);
    }
};

/* =========================================================
   Registo de Inicialização de Páginas
   As páginas chamam window.registerPageInit(nome, fn) para registar
   a sua função de inicialização. core.js chama-a depois de
   o auth estar pronto e os redirecionamentos baseados em função serem tratados.
   ========================================================= */
window._pageInits = {};
window.registerPageInit = function(pageName, initFn) {
    window._pageInits[pageName] = initFn;
};

/* =========================================================
   Observador de Estado de Autenticação
   ========================================================= */
let authInitialized = false;

if (typeof firebase !== 'undefined') {
    auth.onAuthStateChanged(async (user) => {
        const path = window.location.pathname;
        const isLanding = path.endsWith('index.html') || path === '/' || path.endsWith('/');

        // Garantir que o i18n está carregado antes de gerar qualquer conteúdo dinâmico
        if (!Object.keys(i18nData).length) {
            await window.changeLanguage(currentLang);
        }

        if (user) {
            // Mostrar nome instantaneamente (antes da resposta do Firestore)
            const nameEl = document.getElementById('user-display-name');
            const fallbackName = user.displayName || user.email?.split('@')[0] || 'User';
            const quickName = `Welcome, ${toTitleCase(fallbackName)}`;
            if (nameEl && nameEl.textContent === 'Loading...') nameEl.textContent = quickName;

            const userRef = db.collection('users').doc(user.uid);
            let userDoc = await userRef.get();
            let role = 'client';
            let fullName = user.displayName || user.email?.split('@')[0];

            if (!userDoc.exists) {
                await userRef.set({
                    userId: user.uid,
                    full_name: fullName,
                    email: user.email,
                    role: 'client',
                    created_at: firebase.firestore.FieldValue.serverTimestamp()
                });
                userDoc = await userRef.get();
            } else {
                const data = userDoc.data();
                role = data.role || 'client';
                fullName = data.full_name || user.displayName || user.email?.split('@')[0];
                if (!data.userId) await userRef.update({ userId: user.uid });
            }

            const finalName = `Welcome, ${toTitleCase(fullName || 'User')}`;
            if (nameEl) nameEl.textContent = finalName;
            // Guardar nome em cache para aparecer instantaneamente na próxima página
            try { localStorage.setItem('vs_display_name', finalName); } catch(e) {}

            // Redirecionamentos baseados em função na página inicial
            if (isLanding) {
                if (role === 'admin') window.location.href = 'admin.html';
                else if (role === 'driver') window.location.href = 'driver.html';
                else window.location.href = 'booking.html';
            }

            // Proteção de páginas por função
            if (path.includes('driver') && role !== 'driver' && role !== 'admin') window.location.href = 'booking.html';
            if (path.includes('admin') && role !== 'admin') window.location.href = 'booking.html';

            // Inicialização específica da página
            let pageKey = null;
            if (path.includes('booking')) pageKey = 'booking';
            else if (path.includes('dashboard')) pageKey = 'dashboard';
            else if (path.includes('driver')) pageKey = 'driver';
            else if (path.includes('admin')) pageKey = 'admin';
            else if (path.includes('cars')) pageKey = 'cars';

            if (pageKey && window._pageInits[pageKey]) {
                window._pageInits[pageKey](user);
            }

        } else {
            // Redirecionar sempre utilizadores não autenticados de páginas protegidas
            const isProtectedPage = path.includes('booking') || path.includes('dashboard') || 
                                    path.includes('driver') || path.includes('admin') || path.includes('cars');
            if (isProtectedPage) {
                window.location.href = 'index.html';
            } else if (authInitialized && !isLanding) {
                window.location.href = 'index.html';
            }
        }

        // Carregar avaliações se o módulo shared-ui já carregou
        if (typeof window.loadReviews === 'function') window.loadReviews();

        authInitialized = true;
    });
} else {
    const mainEl = document.querySelector('main');
    if (mainEl) {
        mainEl.innerHTML = '<div style="text-align:center;padding:60px 20px;"><h2 style="color:#ff4444;">Erro de Ligação</h2><p style="color:#aaa;">Não foi possível ligar ao Firebase. Por favor, verifique a sua ligação à Internet e certifique-se de que o Firestore está ativado na Consola Firebase.</p></div>' + mainEl.innerHTML;
    }
}

/* =========================================================
   Redirecionamento de segurança para utilizadores não autenticados em páginas protegidas
   Executa após o Firebase ter tido tempo para inicializar
   ========================================================= */
if (typeof firebase !== 'undefined') {
    setTimeout(() => {
        const path = window.location.pathname;
        const isProtectedPage = path.includes('booking') || path.includes('dashboard') || 
                                path.includes('driver') || path.includes('admin') || path.includes('cars');
        if (isProtectedPage && !auth.currentUser) {
            window.location.href = 'index.html';
        }
    }, 1500);
}

/* =========================================================
   Inicialização
   ========================================================= */
(async function init() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    const btn = document.getElementById('theme-btn');
    if (btn) btn.querySelector('i').className = savedTheme === 'light' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';

    // Mostrar nome em cache instantaneamente para que "Loading..." desapareça antes do Firebase responder
    const cachedName = localStorage.getItem('vs_display_name');
    if (cachedName) {
        const el = document.getElementById('user-display-name');
        if (el && el.textContent === 'Loading...') el.textContent = cachedName;
    }

    await window.changeLanguage(currentLang);
})();
