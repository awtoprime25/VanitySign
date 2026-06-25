/* =========================================================
   Página Inicial: Login e Termos
   ========================================================= */

function hasTosAgreed() {
    return localStorage.getItem('tos_agreed') === 'true';
}

window.handleLoginAttempt = function() {
    if (hasTosAgreed()) {
        openAuthModal();
    } else {
        document.getElementById('tosModal').classList.add('show');
        const checkbox = document.getElementById('tos-checkbox');
        const confirmBtn = document.getElementById('tos-confirm-btn');
        if (checkbox && confirmBtn) {
            checkbox.checked = false;
            confirmBtn.disabled = true;
            confirmBtn.style.opacity = '0.5';
            confirmBtn.style.cursor = 'not-allowed';
            checkbox.addEventListener('change', () => {
                confirmBtn.disabled = !checkbox.checked;
                confirmBtn.style.opacity = checkbox.checked ? '1' : '0.5';
                confirmBtn.style.cursor = checkbox.checked ? 'pointer' : 'not-allowed';
            });
        }
    }
};

window.closeTosModal = function() {
    document.getElementById('tosModal').classList.remove('show');
};

window.confirmTosAndLogin = function() {
    localStorage.setItem('tos_agreed', 'true');
    window.closeTosModal();
    openAuthModal();
};

/* =========================================================
   Modal de Autenticação
   ========================================================= */
window.openAuthModal = function() {
    document.getElementById('authModal').classList.add('show');
};

window.closeAuthModal = function() {
    document.getElementById('authModal').classList.remove('show');
    clearAllAuthErrors();
    ['auth-email','auth-password','reg-name','reg-email','reg-password','reg-password-confirm'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.value = ''; el.classList.remove('error'); }
    });
    const regTos = document.getElementById('reg-tos');
    if (regTos) regTos.checked = false;
};

window.switchAuthPanel = function(panel) {
    const loginPanel = document.getElementById('login-panel');
    const registerPanel = document.getElementById('register-panel');
    const title = document.getElementById('auth-title');
    clearAllAuthErrors();

    if (panel === 'login') {
        loginPanel.classList.remove('hidden');
        registerPanel.classList.add('hidden');
        if (title) { title.textContent = window.t('login') || 'Login'; title.setAttribute('data-i18n', 'login'); }
    } else {
        loginPanel.classList.add('hidden');
        registerPanel.classList.remove('hidden');
        if (title) { title.textContent = window.t('register') || 'Create Account'; title.setAttribute('data-i18n', 'register'); }
    }
};

window.addEventListener('click', (e) => {
    const am = document.getElementById('authModal');
    if (e.target === am) window.closeAuthModal();
});

/* =========================================================
   Funções de Erro
   ========================================================= */
function showError(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) { el.textContent = message; el.classList.add('show'); }
}

function hideError(elementId) {
    const el = document.getElementById(elementId);
    if (el) { el.textContent = ''; el.classList.remove('show'); }
}

function setInputError(inputId, hasError) {
    const el = document.getElementById(inputId);
    if (el) el.classList.toggle('error', hasError);
}

function clearAllAuthErrors() {
    const errors = document.querySelectorAll('#authModal .error-msg');
    errors.forEach(e => { e.textContent = ''; e.classList.remove('show'); });
    const inputs = document.querySelectorAll('#authModal .auth-input');
    inputs.forEach(i => i.classList.remove('error'));
}

function setButtonLoading(btnId, loading) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = loading;
    if (loading) {
        btn.dataset.originalText = btn.textContent;
        btn.textContent = '...';
    } else if (btn.dataset.originalText) {
        btn.textContent = btn.dataset.originalText;
    }
}

/* =========================================================
   Login com Google
   ========================================================= */
window.handleGoogleLoginFromModal = async function() {
    if (!hasTosAgreed()) {
        window.closeAuthModal();
        document.getElementById('tosModal').classList.add('show');
        return;
    }
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        await auth.signInWithPopup(provider);
        window.closeAuthModal();
    } catch (error) {
        console.error("Google login error:", error.code, error.message);
        if (error.code === 'auth/popup-closed-by-user') return; // Utilizador cancelou, sem mensagem necessária
        showError('login-general-error', "Google login failed: " + error.message);
    }
};

window.handleLogin = async function() {
    window.handleLoginAttempt();
};

/* =========================================================
   Login com Email/Palavra-passe
   ========================================================= */
window.handleEmailLogin = async function() {
    if (!auth || !auth.signInWithEmailAndPassword) {
        showError('login-general-error', window.t('auth_not_ready') || "Auth not ready. Please refresh the page.");
        return;
    }

    clearAllAuthErrors();
    const email = document.getElementById('auth-email')?.value.trim();
    const password = document.getElementById('auth-password')?.value;

    let hasError = false;
    if (!email) {
        showError('login-email-error', window.t('field_required') || "Please enter your email.");
        setInputError('auth-email', true);
        hasError = true;
    }
    if (!password) {
        showError('login-password-error', window.t('field_required') || "Please enter your password.");
        setInputError('auth-password', true);
        hasError = true;
    }
    if (hasError) return;

    setButtonLoading('btn-login', true);

    try {
        await auth.signInWithEmailAndPassword(email, password);
        window.closeAuthModal();
    } catch (error) {
        console.error("Login error:", error.code, error.message);
        if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
            showError('login-general-error', window.t('user_not_found') || "No account found with this email. Want to create one?");
        } else if (error.code === 'auth/wrong-password') {
            showError('login-password-error', window.t('wrong_password') || "Wrong password. Please try again.");
            setInputError('auth-password', true);
        } else if (error.code === 'auth/invalid-email') {
            showError('login-email-error', window.t('invalid_email') || "Please enter a valid email address.");
            setInputError('auth-email', true);
        } else if (error.code === 'auth/user-disabled') {
            showError('login-general-error', window.t('account_disabled') || "This account has been disabled.");
        } else if (error.code === 'auth/too-many-requests') {
            showError('login-general-error', window.t('too_many_attempts') || "Too many failed attempts. Please try again later.");
        } else if (error.code === 'auth/network-request-failed') {
            showError('login-general-error', window.t('network_error') || "Connection failed. Check your internet and try again.");
        } else {
            showError('login-general-error', window.t('login_failed') || "Login failed. Please try again.");
        }
    } finally {
        setButtonLoading('btn-login', false);
    }
};

/* =========================================================
   Registo com Email/Palavra-passe
   ========================================================= */
window.handleEmailRegister = async function() {
    if (!auth || !auth.createUserWithEmailAndPassword) {
        showError('reg-general-error', window.t('auth_not_ready') || "Auth not ready. Please refresh the page.");
        return;
    }

    clearAllAuthErrors();
    const fullName = document.getElementById('reg-name')?.value.trim();
    const email = document.getElementById('reg-email')?.value.trim();
    const password = document.getElementById('reg-password')?.value;
    const confirm = document.getElementById('reg-password-confirm')?.value;
    const tosAgreed = document.getElementById('reg-tos')?.checked;

    let hasError = false;
    if (!fullName) {
        showError('reg-name-error', window.t('field_required') || "Please enter your full name.");
        setInputError('reg-name', true);
        hasError = true;
    }
    if (!email) {
        showError('reg-email-error', window.t('field_required') || "Please enter your email.");
        setInputError('reg-email', true);
        hasError = true;
    }
    if (!password) {
        showError('reg-password-error', window.t('field_required') || "Please enter a password.");
        setInputError('reg-password', true);
        hasError = true;
    } else if (password.length < 6) {
        showError('reg-password-error', window.t('password_too_short') || "Password must be at least 6 characters.");
        setInputError('reg-password', true);
        hasError = true;
    }
    if (!confirm) {
        showError('reg-confirm-error', window.t('field_required') || "Please confirm your password.");
        setInputError('reg-password-confirm', true);
        hasError = true;
    } else if (password !== confirm) {
        showError('reg-confirm-error', window.t('password_mismatch') || "Passwords do not match.");
        setInputError('reg-password-confirm', true);
        hasError = true;
    }
    if (!tosAgreed) {
        showError('reg-tos-error', window.t('agree_tos') || "Please agree to the Terms of Service.");
        hasError = true;
    }
    if (hasError) return;

    setButtonLoading('btn-register', true);

    try {
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        const user = cred.user;
        await user.updateProfile({ displayName: fullName });
        localStorage.setItem('tos_agreed', 'true');
        await db.collection('users').doc(user.uid).set({
            userId: user.uid,
            full_name: fullName,
            email: email,
            role: 'client',
            created_at: firebase.firestore.FieldValue.serverTimestamp()
        });
        // Enviar email de verificação (gratuito no Spark; não bloqueia o acesso)
        try { await user.sendEmailVerification(); } catch (e) { console.warn("Verification email failed:", e); }
        window.closeAuthModal();
        const verifyMsg = window.t('verify_email_sent', { email: email });
        alert(verifyMsg === 'verify_email_sent'
            ? "Account created! We've sent a confirmation email to " + email + ". Please check your inbox to verify your address."
            : verifyMsg);
    } catch (error) {
        console.error("Register error:", error.code, error.message);
        if (error.code === 'auth/email-already-in-use') {
            showError('reg-email-error', window.t('email_in_use') || "This email is already registered. Sign in instead?");
            setInputError('reg-email', true);
        } else if (error.code === 'auth/invalid-email') {
            showError('reg-email-error', window.t('invalid_email') || "Please enter a valid email address.");
            setInputError('reg-email', true);
        } else if (error.code === 'auth/weak-password') {
            showError('reg-password-error', window.t('password_too_short') || "Password must be at least 6 characters.");
            setInputError('reg-password', true);
        } else if (error.code === 'auth/network-request-failed') {
            showError('reg-general-error', window.t('network_error') || "Connection failed. Check your internet and try again.");
        } else {
            showError('reg-general-error', window.t('register_failed') || "Registration failed. Please try again.");
        }
    } finally {
        setButtonLoading('btn-register', false);
    }
};

/* =========================================================
   Inicialização da Página
   ========================================================= */
function initIndexPage(user) {
    if (user) {
        // o listener de autenticação core.js trata do redirecionamento
    }
}

window.registerPageInit('index', initIndexPage);
