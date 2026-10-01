const API_URL = 'http://localhost:3000';

// Storage sementara data dari server untuk pencarian instan
let allGames = [];
let allUsers = [];
let allPosts = [];

// 1. Proteksi Akses Admin
const currentUser = JSON.parse(localStorage.getItem('user'));
if (!currentUser || !currentUser.role || currentUser.role.toLowerCase() !== 'admin') {
    alert('Akses ditolak! Halaman ini khusus untuk Admin.');
    window.location.href = '../home.html';
}

// Detect current page
const currentPage = window.location.pathname.split('/').pop();

function formatImageUrl(imagePath) {
    if (!imagePath) return null;
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
    const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
    return `${API_URL}${cleanPath}`;
}

function showMessage(msg, isSuccess = false) {
    const statusMsg = document.getElementById('status-msg');
    if (statusMsg) {
        statusMsg.style.display = 'block';
        statusMsg.style.backgroundColor = isSuccess ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)';
        statusMsg.style.color = isSuccess ? '#4ade80' : '#f87171';
        statusMsg.style.border = `1px solid ${isSuccess ? '#22c55e' : '#ef4444'}`;
        statusMsg.textContent = msg;
        setTimeout(() => { statusMsg.style.display = 'none'; }, 3000);
    }
}

// 2. Fetch Statistik
async function loadDashboardStats() {
    try {
        const res = await fetch(`${API_URL}/api/stats`);
        if (res.ok) {
            const stats = await res.json();
            setText('stat-users', stats.users || 0);
            setText('stat-games', stats.games || 0);
            setText('stat-posts', stats.posts || 0);
            setText('stat-likes', stats.likes || 0);
            setText('stat-comments', stats.comments || 0);
            setText('stat-feedbacks', stats.feedbacks || 0);
        }
    } catch (err) { console.error('Gagal memuat statistik:', err); }
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

// 3. Render Tabel Games & Filtering
async function loadGamesTable() {
    const tbody = document.getElementById('games-table-body');
    try {
        const res = await fetch(`${API_URL}/api/games`);
        allGames = await res.json();
        renderGames(allGames);
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="5" class="table-loading" style="color:#ef4444;">Gagal memuat data game.</td></tr>';
    }
}

function renderGames(data) {
    const tbody = document.getElementById('games-table-body');
    if (!Array.isArray(data) || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="table-loading">Game tidak ditemukan.</td></tr>';
        return;
    }

    tbody.innerHTML = data.map(g => {
        const rawCover = g.cover_url || g.cover_image || g.cover;
        const cover = formatImageUrl(rawCover) || 'https://placehold.co/60x60/1e293b/818cf8?text=Game';

        return `
            <tr>
                <td>#${g.id}</td>
                <td><img src="${cover}" class="mini-cover-img" alt="${g.title}" onerror="this.src='https://placehold.co/60x60/1e293b/818cf8?text=Game'"></td>
                <td><b>${g.title}</b></td>
                <td><span style="background: rgba(99, 102, 241, 0.15); color: #818cf8; padding: 2px 8px; border-radius: 4px; font-size: 11px;">${g.genre || 'Game'}</span></td>
                <td>
                    <button class="btn-delete" onclick="deleteGame(${g.id})">
                        <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i> Hapus
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons();
}

// 4. Render Tabel Users & Filtering
async function loadUsersTable() {
    const tbody = document.getElementById('users-table-body');
    try {
        const res = await fetch(`${API_URL}/api/users`);
        allUsers = await res.json();
        renderUsers(allUsers);
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="5" class="table-loading" style="color:#ef4444;">Gagal memuat data user.</td></tr>';
    }
}

function renderUsers(data) {
    const tbody = document.getElementById('users-table-body');
    if (!Array.isArray(data) || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="table-loading">User tidak ditemukan.</td></tr>';
        return;
    }

    tbody.innerHTML = data.map(u => `
        <tr>
            <td>#${u.id}</td>
            <td><b>${u.username}</b></td>
            <td><span style="background: rgba(99, 102, 241, 0.15); color: #818cf8; padding: 2px 8px; border-radius: 4px; font-size: 11px;">${u.role}</span></td>
            <td>
                <span style="color: ${u.is_banned ? '#ef4444' : '#10b981'}; font-weight: 600;">
                    ${u.is_banned ? 'Banned' : 'Aktif'}
                </span>
            </td>
            <td>
                ${u.role !== 'admin' ? `
                    <button class="btn-delete" style="${u.is_banned ? 'background: rgba(16, 185, 129, 0.15); color: #10b981;' : ''}" onclick="toggleBanUser(${u.id},${u.is_banned ? 0 : 1})">
                        ${u.is_banned ? 'Unban' : 'Ban User'}
                    </button>
                ` : '<small style="color:#aaa;">No Action</small>'}
            </td>
        </tr>
    `).join('');

    if (window.lucide) lucide.createIcons();
}

// 5. Render Tabel Posts & Filtering
async function loadPostsTable() {
    const tbody = document.getElementById('posts-table-body');
    try {
        const res = await fetch(`${API_URL}/api/posts`);
        allPosts = await res.json();
        renderPosts(allPosts);
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="6" class="table-loading" style="color:#ef4444;">Gagal memuat postingan.</td></tr>';
    }
}

function renderPosts(data) {
    const tbody = document.getElementById('posts-table-body');
    if (!Array.isArray(data) || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="table-loading">Postingan tidak ditemukan.</td></tr>';
        return;
    }

    tbody.innerHTML = data.map(p => {
        const shortContent = p.content.length > 40 ? p.content.substring(0, 40) + '...' : p.content;
        return `
            <tr>
                <td>#${p.id}</td>
                <td><b>${p.username || 'User'}</b></td>
                <td>${p.game_title || 'Game'}</td>
                <td>${shortContent}</td>
                <td><span style="background: rgba(16, 185, 129, 0.15); color: #34d399; padding: 2px 8px; border-radius: 4px; font-size: 11px;">${p.status || 'Playing'}</span></td>
                <td>
                    <button class="btn-delete" onclick="deletePost(${p.id})">
                        <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i> Hapus
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons();
}

// 5.5 Render Tabel Reports
async function loadReportsTable() {
    const tbody = document.getElementById('reports-table-body');
    try {
        const res = await fetch(`${API_URL}/api/reports`);
        const items = await res.json();

        if (!Array.isArray(items) || items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="table-loading">Belum ada laporan masuk.</td></tr>';
            return;
        }

        tbody.innerHTML = items.map(r => `
            <tr>
                <td>#${r.id}</td>
                <td><b>${r.reporter_name}</b></td>
                <td><b>${r.poster_name}</b></td>
                <td>${r.reason}${r.description ? `<br><small style="color:#94a3b8;">${r.description}</small>` : ''}</td>
                <td>
                    <span style="background: ${r.status === 'resolved' ? 'rgba(16, 185, 129, 0.15)' : r.status === 'dismissed' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)'}; 
                        color: ${r.status === 'resolved' ? '#34d399' : r.status === 'dismissed' ? '#f87171' : '#fbbf24'}; 
                        padding: 2px 8px; border-radius: 4px; font-size: 11px;">
                        ${r.status || 'pending'}
                    </span>
                </td>
                <td>
                    <button class="btn-delete" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border-color: rgba(16, 185, 129, 0.3); margin-right: 5px;" onclick="resolveReport(${r.id})">
                        Resolve
                    </button>
                    <button class="btn-delete" onclick="dismissReport(${r.id})">
                        Dismiss
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="6" class="table-loading" style="color:#ef4444;">Gagal memuat laporan.</td></tr>';
    }
}

window.resolveReport = async function(id) {
    if (!confirm('Resolve laporan ini? Postingan yang dilaporkan akan dihapus.')) return;
    try {
        // Ambil post_id dari report
        const reportsRes = await fetch(`${API_URL}/api/reports`);
        const reports = await reportsRes.json();
        const report = reports.find(r => r.id === id);
        
        if (!report) {
            showMessage('Laporan tidak ditemukan.');
            return;
        }

        // Hapus postingan yang dilaporkan
        const deleteRes = await fetch(`${API_URL}/api/posts/${report.post_id}`, {
            method: 'DELETE'
        });

        if (!deleteRes.ok) {
            showMessage('Gagal menghapus postingan.');
            return;
        }

        // Update status report jadi resolved
        const res = await fetch(`${API_URL}/api/reports/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'resolved' })
        });

        if (res.ok) {
            showMessage('Laporan di-resolve dan postingan dihapus.', true);
            loadReportsTable();
        }
    } catch (err) { showMessage('Gagal resolve laporan.'); }
};

window.dismissReport = async function(id) {
    try {
        const res = await fetch(`${API_URL}/api/reports/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'dismissed' })
        });
        if (res.ok) {
            showMessage('Laporan di-dismiss.', true);
            loadReportsTable();
        }
    } catch (err) { showMessage('Gagal dismiss laporan.'); }
};

// 6. Render Tabel Feedbacks
async function loadFeedbacksTable() {
    const tbody = document.getElementById('feedbacks-table-body');
    try {
        const res = await fetch(`${API_URL}/api/feedbacks`);
        const items = await res.json();

        if (!Array.isArray(items) || items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="table-loading">Belum ada feedback / request game masuk.</td></tr>';
            return;
        }

        tbody.innerHTML = items.map(f => `
            <tr>
                <td>#${f.id}</td>
                <td><b>${f.username}</b></td>
                <td>${f.post_id ? `#${f.post_id}` : '-'}</td>
                <td>${f.message}</td>
                <td>
                    <button class="btn-delete" onclick="deleteFeedback(${f.id})">Hapus</button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="5" class="table-loading" style="color:#ef4444;">Gagal memuat feedback.</td></tr>';
    }
}

// 7. Event Listener Pencarian Real-Time (hanya untuk elemen yang ada)
function initSearchListeners() {
    // Search Game
    const searchGames = document.getElementById('search-games');
    if (searchGames) {
        searchGames.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            const filtered = allGames.filter(g => 
                g.title.toLowerCase().includes(query) || 
                (g.genre && g.genre.toLowerCase().includes(query)) ||
                g.id.toString().includes(query)
            );
            renderGames(filtered);
        });
    }

    // Search User
    const searchUsers = document.getElementById('search-users');
    if (searchUsers) {
        searchUsers.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            const filtered = allUsers.filter(u => 
                u.username.toLowerCase().includes(query) || 
                u.role.toLowerCase().includes(query) ||
                u.id.toString().includes(query)
            );
            renderUsers(filtered);
        });
    }

    // Search Post
    const searchPosts = document.getElementById('search-posts');
    if (searchPosts) {
        searchPosts.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            const filtered = allPosts.filter(p => 
                (p.username && p.username.toLowerCase().includes(query)) || 
                (p.game_title && p.game_title.toLowerCase().includes(query)) ||
                (p.content && p.content.toLowerCase().includes(query)) ||
                p.id.toString().includes(query)
            );
            renderPosts(filtered);
        });
    }
}

// 8. Actions (Add, Delete, Ban)
const addGameForm = document.getElementById('add-game-form');
if (addGameForm) {
    addGameForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('game-title').value.trim();
        const genre = document.getElementById('game-genre').value.trim();
        const coverFile = document.getElementById('game-cover-file')?.files[0];
        const coverUrl = document.getElementById('game-cover-url')?.value.trim();

        if (!title || !genre) return;

        const formData = new FormData();
        formData.append('title', title);
        formData.append('genre', genre);

        if (coverFile) {
            formData.append('cover', coverFile);
        } else if (coverUrl) {
            formData.append('cover_url', coverUrl);
        }

        try {
            const res = await fetch(`${API_URL}/api/games`, { method: 'POST', body: formData });
            if (res.ok) {
                showMessage('Game baru berhasil ditambahkan!', true);
                document.getElementById('add-game-form').reset();
                loadGamesTable();
                loadDashboardStats();
            } else {
                const data = await res.json();
                showMessage(data.message || 'Gagal menambahkan game.');
            }
        } catch (err) { showMessage('Gagal terhubung ke server.'); }
    });
}

window.deleteGame = async function(gameId) {
    if (!confirm(`Hapus Game #${gameId}? Semua postingan terkait juga akan terhapus.`)) return;
    try {
        const res = await fetch(`${API_URL}/api/games/${gameId}`, { method: 'DELETE' });
        if (res.ok) {
            showMessage('Game berhasil dihapus.', true);
            loadGamesTable();
            loadPostsTable();
            loadDashboardStats();
        }
    } catch (err) { showMessage('Gagal menghapus game.'); }
};

window.toggleBanUser = async function(userId, newStatus) {
    if (!confirm(`Ubah status ban user #${userId}?`)) return;
    try {
        const res = await fetch(`${API_URL}/api/users/${userId}/ban`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_banned: newStatus })
        });
        if (res.ok) {
            showMessage('Status Ban User diperbarui.', true);
            loadUsersTable();
        }
    } catch (err) { showMessage('Gagal memproses ban.'); }
};

window.deletePost = async function(postId) {
    if (!confirm(`Hapus Postingan #${postId}?`)) return;
    try {
        const res = await fetch(`${API_URL}/api/posts/${postId}`, { method: 'DELETE' });
        if (res.ok) {
            showMessage('Postingan berhasil dihapus.', true);
            loadPostsTable();
            loadDashboardStats();
        }
    } catch (err) { showMessage('Gagal menghapus postingan.'); }
};

window.deleteFeedback = async function(id) {
    try {
        const res = await fetch(`${API_URL}/api/feedbacks/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showMessage('Feedback dihapus.', true);
            loadFeedbacksTable();
        }
    } catch (err) { showMessage('Gagal menghapus feedback.'); }
};

// Inisialisasi berdasarkan halaman
document.addEventListener('DOMContentLoaded', () => {
    if (window.lucide) lucide.createIcons();
    
    if (currentPage === 'admin.html') {
        loadDashboardStats();
    } else if (currentPage === 'admin-games.html') {
        loadGamesTable();
        initSearchListeners();
    } else if (currentPage === 'admin-users.html') {
        loadUsersTable();
        initSearchListeners();
    } else if (currentPage === 'admin-posts.html') {
        loadPostsTable();
        initSearchListeners();
    } else if (currentPage === 'admin-feedbacks.html') {
        loadFeedbacksTable();
    } else if (currentPage === 'admin-reports.html') {
        loadReportsTable();
    }
});