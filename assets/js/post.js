lucide.createIcons();

const API_URL = '';
const user = JSON.parse(localStorage.getItem('user'));

// Jika belum login, alihkan otomatis ke login.html
if (!user) {
    window.location.href = 'login.html';
}

function checkAdminStatus() {
    const adminBtn = document.getElementById('admin-menu-btn');
    if (user && user.role && user.role.toLowerCase() === 'admin' && adminBtn) {
        adminBtn.style.display = 'flex';
    }
}

function showMessage(msg, isSuccess = false) {
    const statusMsg = document.getElementById('status-msg');
    if (statusMsg) {
        statusMsg.style.display = 'block';
        statusMsg.style.backgroundColor = isSuccess ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)';
        statusMsg.style.color = isSuccess ? '#4ade80' : '#f87171';
        statusMsg.style.border = `1px solid ${isSuccess ? '#22c55e' : '#ef4444'}`;
        statusMsg.textContent = msg;
    }
}

async function loadGameOptions() {
    const selectGame = document.getElementById('post-game-id');
    try {
        const response = await fetch(`${API_URL}/api/games`);
        if (response.ok) {
            const games = await response.json();
            selectGame.innerHTML = '<option value="" disabled selected>-- Pilih Game --</option>';
            games.forEach(game => {
                selectGame.innerHTML += `<option value="${game.id}">${game.title}</option>`;
            });
        }
    } catch (err) {
        console.error('Gagal mengambil daftar game:', err);
        selectGame.innerHTML = '<option value="" disabled>Gagal memuat game</option>';
    }
}

// LOGIKA MODAL POPUP REQUEST GAME
function initRequestGameModal() {
    const modal = document.getElementById('request-game-modal');
    const openBtn = document.getElementById('open-request-modal');
    const closeBtn = document.getElementById('close-request-modal');
    const cancelBtn = document.getElementById('btn-cancel-req');
    const reqForm = document.getElementById('request-game-form');

    if (!modal) return;

    const closeModal = () => {
        modal.classList.remove('active');
        reqForm.reset();
    };

    openBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        modal.classList.add('active');
    });

    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Submit Request Game
    reqForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const gameName = document.getElementById('req-game-name').value.trim();
        if (!gameName) return;

        const sendBtn = document.getElementById('btn-send-req');
        sendBtn.disabled = true;
        sendBtn.textContent = 'Mengirim...';

        try {
            const res = await fetch(`${API_URL}/api/feedbacks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user.id,
                    message: `[REQUEST GAME] Tolong tambahkan game: ${gameName}`
                })
            });

            if (res.ok) {
                closeModal();
                showMessage(`Request game "${gameName}" berhasil dikirim ke Admin!`, true);
            } else {
                showMessage('Gagal mengirim request game.');
            }
        } catch (err) {
            console.error('Error request game:', err);
            showMessage('Gagal terhubung ke server backend.');
        } finally {
            sendBtn.disabled = false;
            sendBtn.textContent = 'Kirim Request';
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    checkAdminStatus();
    loadGameOptions();
    initRequestGameModal();

    const createPostForm = document.getElementById('create-post-form');
    const submitBtn = document.getElementById('submit-btn');

    if (createPostForm) {
        createPostForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const gameId = document.getElementById('post-game-id').value;
            const status = document.getElementById('post-status').value;
            const content = document.getElementById('post-content').value.trim();
            const imageInput = document.getElementById('post-image');

            if (!gameId || !content) {
                showMessage('Pilih game dan isi ulasan terlebih dahulu!');
                return;
            }

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Menerbitkan...';
            }

            const formData = new FormData();
            formData.append('user_id', user.id);
            formData.append('game_id', gameId);
            formData.append('status', status);
            formData.append('content', content);

            if (imageInput.files[0]) {
                formData.append('image', imageInput.files[0]);
            }

            try {
                const response = await fetch(`${API_URL}/api/posts`, {
                    method: 'POST',
                    body: formData
                });

                const result = await response.json();

                if (response.ok) {
                    showMessage('Postingan berhasil dibuat! Mengalihkan...', true);
                    setTimeout(() => {
                        window.location.href = '../home.html';
                    }, 800);
                } else {
                    showMessage(result.error || result.message || 'Gagal membuat postingan.');
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Posting Sekarang';
                    }
                }
            } catch (err) {
                console.error('Error Submit Post:', err);
                showMessage('Gagal terhubung ke server backend!');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Posting Sekarang';
                }
            }
        });
    }
});