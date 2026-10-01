const API_URL = 'http://localhost:3000';

// Get user from localStorage
let currentUser = JSON.parse(localStorage.getItem('user'));

if (!currentUser || !currentUser.id) {
    document.querySelector('.profile-container').innerHTML = 
        '<p style="text-align:center;color:#94a3b8;padding:50px;">Silakan login untuk melihat profile.</p>';
} else {
    initProfile();
}

async function initProfile() {
    try {
        // Fetch latest user data from server
        const userRes = await fetch(`${API_URL}/api/users/${currentUser.id}`);
        if (!userRes.ok) throw new Error('Gagal load user');
        
        const user = await userRes.json();
        
        // Update localStorage dengan data terbaru
        currentUser = { ...currentUser, ...user };
        localStorage.setItem('user', JSON.stringify(currentUser));
        
        // Render profile
        renderProfile(user);
        
        // Load posts
        await loadUserPosts(currentUser.id);
        
    } catch (err) {
        console.error('Gagal memuat profile:', err);
        // Fallback: tampilkan data dari localStorage
        if (currentUser) {
            renderProfile(currentUser);
            await loadUserPosts(currentUser.id);
        }
    }
}

function renderProfile(user) {
    // Avatar
    const avatarEl = document.getElementById('profile-avatar');
    if (avatarEl) {
        if (user.avatar) {
            avatarEl.innerHTML = `<img src="${API_URL}${user.avatar}" alt="${user.username}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        } else {
            avatarEl.textContent = (user.username || 'U').charAt(0).toUpperCase();
        }
    }

    // Name (display name) - bedakan dari username
    const nameEl = document.getElementById('profile-name');
    if (nameEl) nameEl.textContent = user.name || user.username || 'User';
    
    // Username dengan @
    const usernameDisplayEl = document.getElementById('profile-username-display');
    if (usernameDisplayEl) usernameDisplayEl.textContent = `@${user.username || 'user'}`;
    
    // Bio
    const bioDisplayEl = document.getElementById('profile-bio-display');
    if (bioDisplayEl) bioDisplayEl.textContent = user.bio || 'Gamer';
    
    // Detail items
    setText('profile-name-detail', user.name || user.username || 'User');
    setText('profile-username', `@${user.username || 'user'}`);
    setText('profile-email', user.email || 'Tidak ada email');
    setText('profile-bio', user.bio || 'Belum ada bio');
    setText('profile-joined', user.created_at ? new Date(user.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'long' }) : '-');
}

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

async function loadUserPosts(userId) {
    const container = document.getElementById('user-posts');
    if (!container) return;

    try {
        const res = await fetch(`${API_URL}/api/users/${userId}/posts`);
        if (!res.ok) throw new Error('Gagal load posts');
        
        const posts = await res.json();

        if (!Array.isArray(posts) || posts.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:#94a3b8;padding:20px;">Belum ada postingan.</p>';
            // Update stats ke 0
            updateStats(posts);
            return;
        }

        // Render posts
        container.innerHTML = posts.map(p => {
            const gameCover = p.game_cover ? `${API_URL}${p.game_cover}` : 'https://placehold.co/150x150/1e293b/818cf8?text=Game';
            const statusClass = `status-${(p.status || 'playing').toLowerCase().replace(/\s+/g, '-')}`;
            const postImage = p.post_image ? `<img src="${API_URL}${p.post_image}" style="width:100%;max-height:200px;object-fit:cover;border-radius:8px;margin-top:10px;">` : '';
            
            // Avatar user
            const userAvatar = p.user_avatar 
                ? `<img src="${API_URL}${p.user_avatar}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;" alt="${p.username}">`
                : `<div style="width:36px;height:36px;border-radius:50%;background:#2563eb;display:flex;align-items:center;justify-content:center;font-weight:600;color:#fff;font-size:14px;">${(p.username || 'U').charAt(0).toUpperCase()}</div>`;

            return `
                <div class="post-card" style="background:#1e293b;border:1px solid #293548;border-radius:12px;overflow:hidden;">
                    <div class="post-header" style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;">
                        <div class="post-user-info" style="display:flex;align-items:center;gap:12px;">
                            ${userAvatar}
                            <div>
                                <div style="font-size:14px;font-weight:600;">${p.name || p.username || 'User'}</div>
                                <div style="font-size:11px;color:#818cf8;">@${p.username || 'user'}</div>
                                <div style="font-size:11px;color:#94a3b8;">${formatRelativeTime(p.created_at)}</div>
                            </div>
                        </div>
                        <div style="display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.05);padding:4px 12px;border-radius:20px;">
                            <img src="${gameCover}" style="width:20px;height:20px;border-radius:4px;object-fit:cover;" alt="${p.game_title}">
                            <span style="font-size:12px;color:#94a3b8;">${p.game_title || 'Game'}</span>
                        </div>
                    </div>
                    ${postImage}
                    <div style="padding:16px;">
                        <span style="display:inline-block;font-size:11px;font-weight:600;padding:3px 8px;border-radius:4px;margin-bottom:8px;text-transform:uppercase;" class="${statusClass}">${p.status || 'Playing'}</span>
                        <p style="font-size:14px;color:#cbd5e1;line-height:1.5;margin-top:6px;">${p.content}</p>
                    </div>
                    <div style="padding:12px 16px;border-top:1px solid rgba(255,255,255,0.05);display:flex;gap:8px;">
                        <span style="color:#94a3b8;font-size:13px;display:inline-flex;align-items:center;gap:4px;">
                            <i data-lucide="heart" style="width:14px;height:14px;"></i> ${p.total_likes || 0} Likes
                        </span>
                    </div>
                </div>
            `;
        }).join('');

        if (window.lucide) lucide.createIcons();
        
        // Update stats
        updateStats(posts);
        
    } catch (err) {
        console.error('Gagal memuat postingan:', err);
        container.innerHTML = '<p style="text-align:center;color:#ef4444;padding:20px;">Gagal memuat postingan.</p>';
    }
}

function updateStats(posts) {
    const total = Array.isArray(posts) ? posts.length : 0;
    const playing = Array.isArray(posts) ? posts.filter(p => p.status === 'Playing').length : 0;
    const completed = Array.isArray(posts) ? posts.filter(p => p.status === 'Completed').length : 0;
    
    setText('stat-posts', total);
    setText('stat-playing', playing);
    setText('stat-completed', completed);
}

function formatRelativeTime(dateString) {
    if (!dateString) return 'Baru saja';
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return `${diff} detik lalu`;
    if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
    return `${Math.floor(diff / 86400)} hari lalu`;
}

// Edit Profile
document.getElementById('edit-profile-btn')?.addEventListener('click', () => {
    // Pre-fill form dengan data user
    document.getElementById('edit-name').value = currentUser.name || currentUser.username || '';
    document.getElementById('edit-username').value = currentUser.username || '';
    document.getElementById('edit-email').value = currentUser.email || '';
    document.getElementById('edit-bio').value = currentUser.bio || '';
    
    document.getElementById('edit-profile-modal').classList.add('active');
});

document.getElementById('close-edit-modal')?.addEventListener('click', () => {
    document.getElementById('edit-profile-modal').classList.remove('active');
});

document.getElementById('edit-profile-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData();
    formData.append('name', document.getElementById('edit-name').value.trim());
    formData.append('username', document.getElementById('edit-username').value.trim());
    formData.append('email', document.getElementById('edit-email').value.trim());
    formData.append('bio', document.getElementById('edit-bio').value.trim());
    
    const avatarFile = document.getElementById('edit-avatar').files[0];
    if (avatarFile) formData.append('avatar', avatarFile);

    try {
        const res = await fetch(`${API_URL}/api/users/${currentUser.id}/profile`, {
            method: 'PUT',
            body: formData
        });

        if (res.ok) {
            // Refresh data user
            await initProfile();
            document.getElementById('edit-profile-modal').classList.remove('active');
        } else {
            const data = await res.json();
            alert(data.message || 'Gagal update profile');
        }
    } catch (err) {
        console.error('Gagal update profile:', err);
        alert('Gagal update profile');
    }
});

// Change Password
document.getElementById('change-password-btn')?.addEventListener('click', () => {
    document.getElementById('change-password-modal').classList.add('active');
});

document.getElementById('close-password-modal')?.addEventListener('click', () => {
    document.getElementById('change-password-modal').classList.remove('active');
});

document.getElementById('change-password-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;

    if (!currentPassword || !newPassword) {
        alert('Semua kolom wajib diisi!');
        return;
    }

    if (newPassword.length < 6) {
        alert('Password baru minimal 6 karakter!');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/api/users/${currentUser.id}/password`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword, newPassword })
        });

        const data = await res.json();

        if (res.ok) {
            alert('Password berhasil diubah!');
            document.getElementById('change-password-modal').classList.remove('active');
            document.getElementById('change-password-form').reset();
        } else {
            alert(data.message || 'Gagal mengubah password');
        }
    } catch (err) {
        console.error('Gagal mengubah password:', err);
        alert('Gagal mengubah password');
    }
});

// Logout
document.getElementById('logout-btn')?.addEventListener('click', () => {
    localStorage.removeItem('user');
    window.location.href = 'login.html?status=logout';
});