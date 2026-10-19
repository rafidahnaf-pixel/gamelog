const API_URL = window.location.port === '3000' ? '' : (window.location.origin.includes('localhost') ? 'http://localhost:3000' : window.location.origin);

// Helper untuk API call dengan retry
async function apiFetch(url, options = {}, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(url, options);
            return res;
        } catch (err) {
            if (i === retries - 1) throw err;
            await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        }
    }
}

// Get user from localStorage
let currentUser = JSON.parse(localStorage.getItem('user'));

// Cek apakah ada parameter ?id= di URL (lihat profile user lain)
const urlParams = new URLSearchParams(window.location.search);
const profileUserId = urlParams.get('id');
const isOwnProfile = !profileUserId || parseInt(profileUserId) === currentUser?.id;
const targetUserId = isOwnProfile ? currentUser.id : parseInt(profileUserId);

if (!currentUser || !currentUser.id) {
    document.querySelector('.profile-container').innerHTML = 
        '<p style="text-align:center;color:#94a3b8;padding:50px;">Silakan login untuk melihat profile.</p>';
} else {
    initProfile();
}

async function initProfile() {
    try {
        // Fetch user data from server
        const userRes = await fetch(`${API_URL}/api/users/${targetUserId}`);
        if (!userRes.ok) throw new Error('Gagal load user');
        
        const user = await userRes.json();
        
        // Update localStorage hanya jika ini profile sendiri
        if (isOwnProfile) {
            currentUser = { ...currentUser, ...user };
            localStorage.setItem('user', JSON.stringify(currentUser));
        }
        
        // Render profile
        renderProfile(user);
        
        // Tampilkan/tembunyikan tombol berdasarkan apakah ini profile sendiri
        toggleProfileActions(isOwnProfile);
        
        // Cek status follow jika melihat profile user lain
        if (!isOwnProfile) {
            await checkFollowStatus();
        }
        
        // Load followers & following
        await loadFollowData(targetUserId);
        
        // Load posts
        await loadUserPosts(targetUserId);
        
    } catch (err) {
        console.error('Gagal memuat profile:', err);
        // Fallback: tampilkan data dari localStorage
        if (currentUser && isOwnProfile) {
            renderProfile(currentUser);
            await loadUserPosts(currentUser.id);
        }
    }
}

function toggleProfileActions(isOwn) {
    const editBtn = document.getElementById('edit-profile-btn');
    const changePassBtn = document.getElementById('change-password-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const followBtn = document.getElementById('follow-btn');
    
    if (isOwn) {
        if (editBtn) editBtn.style.display = 'inline-flex';
        if (changePassBtn) changePassBtn.style.display = 'inline-flex';
        if (logoutBtn) logoutBtn.style.display = 'inline-flex';
        if (followBtn) followBtn.style.display = 'none';
    } else {
        if (editBtn) editBtn.style.display = 'none';
        if (changePassBtn) changePassBtn.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (followBtn) followBtn.style.display = 'inline-flex';
    }
}

function renderProfile(user) {
    // Avatar
    const avatarEl = document.getElementById('profile-avatar');
    if (avatarEl) {
        if (user.avatar) {
            // Jika avatar sudah URL absolut (Cloudinary), gunakan langsung. 
            // Jika path relatif, tambahkan API_URL di depannya.
            const avatarSrc = (user.avatar.startsWith('http://') || user.avatar.startsWith('https://'))
                ? user.avatar
                : `${API_URL}${user.avatar}`;
            avatarEl.innerHTML = `<img src="${avatarSrc}" alt="${user.username}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
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
                        <div class="post-user-info" style="display:flex;align-items:center;gap:12px;cursor:pointer;" onclick="window.location.href='profile.html?id=${p.user_id}'">
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

// Cek status follow dan update tampilan tombol
async function checkFollowStatus() {
    if (isOwnProfile || !profileUserId) return;
    
    try {
        const res = await apiFetch(`${API_URL}/api/follow/status?follower_id=${currentUser.id}&following_id=${profileUserId}`);
        if (res.ok) {
            const data = await res.json();
            updateFollowButton(data.following);
        }
    } catch (err) {
        console.error('Gagal cek status follow:', err);
    }
}

function updateFollowButton(isFollowing) {
    const followBtn = document.getElementById('follow-btn');
    if (!followBtn) return;
    
    if (isFollowing) {
        followBtn.innerHTML = '<i data-lucide="user-check" style="width:16px;height:16px;"></i> Following';
        followBtn.style.background = 'rgba(54, 173, 163, 0.15)';
        followBtn.style.color = '#36ADA3';
        followBtn.style.borderColor = 'rgba(54, 173, 163, 0.3)';
    } else {
        followBtn.innerHTML = '<i data-lucide="user-plus" style="width:16px;height:16px;"></i> Follow';
        followBtn.style.background = 'transparent';
        followBtn.style.color = '#fff';
        followBtn.style.borderColor = '#2a4a5a';
    }
    
    if (window.lucide) lucide.createIcons();
}

// Follow / Unfollow
document.getElementById('follow-btn')?.addEventListener('click', async () => {
    if (!profileUserId) return;
    
    try {
        const res = await apiFetch(`${API_URL}/api/follow`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                follower_id: currentUser.id,
                following_id: profileUserId
            })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            updateFollowButton(data.following);
            showToast(data.following ? 'Berhasil follow!' : 'Berhasil unfollow!');
        } else {
            alert(data.message || 'Gagal follow');
        }
    } catch (err) {
        console.error('Gagal follow:', err);
        // Verifikasi apakah follow sebenarnya sudah berhasil di server
        try {
            const statusRes = await fetch(`${API_URL}/api/follow/status?follower_id=${currentUser.id}&following_id=${profileUserId}`);
            if (statusRes.ok) {
                const statusData = await statusRes.json();
                if (statusData.following) {
                    updateFollowButton(true);
                    showToast('Berhasil follow!');
                    return;
                }
            }
        } catch (statusErr) {
            console.error('Gagal verifikasi status follow:', statusErr);
        }
        alert('Gagal terhubung ke server. Coba lagi.');
    }
});

// Load followers & following
async function loadFollowData(userId) {
    // Set default count
    setText('followers-count', '0 orang mengikuti');
    setText('following-count', 'Mengikuti 0 orang');

    try {
        // Load followers
        const followersRes = await apiFetch(`${API_URL}/api/users/${userId}/followers`);
        if (followersRes.ok) {
            const followers = await followersRes.json();
            if (Array.isArray(followers)) {
                renderFollowList('followers-list', followers, 'Belum ada followers.');
                setText('followers-count', `${followers.length} orang mengikuti`);
            }
        }

        // Load following
        const followingRes = await apiFetch(`${API_URL}/api/users/${userId}/following`);
        if (followingRes.ok) {
            const following = await followingRes.json();
            if (Array.isArray(following)) {
                renderFollowList('following-list', following, 'Belum follow siapa pun.');
                setText('following-count', `Mengikuti ${following.length} orang`);
            }
        }
    } catch (err) {
        console.error('Gagal memuat follow data:', err);
        // Count tetap 0, tapi list tampil error
        renderFollowList('followers-list', [], 'Gagal memuat followers.');
        renderFollowList('following-list', [], 'Gagal memuat following.');
    }
}

function renderFollowList(elementId, users, emptyMsg) {
    const container = document.getElementById(elementId);
    if (!container) return;

    if (!Array.isArray(users) || users.length === 0) {
        container.innerHTML = `<p style="color:#64748b;font-size:13px;">${emptyMsg}</p>`;
        return;
    }

    container.innerHTML = users.map(u => {
        const avatar = u.avatar 
            ? `<img src="${u.avatar}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;" alt="${u.username}">`
            : `<div style="width:36px;height:36px;border-radius:50%;background:#FE7F2D;display:flex;align-items:center;justify-content:center;font-weight:600;color:#fff;font-size:14px;flex-shrink:0;">${(u.username || 'U').charAt(0).toUpperCase()}</div>`;

        return `
            <div style="display:flex;align-items:center;gap:12px;padding:8px;background:rgba(0,0,0,0.2);border-radius:8px;cursor:pointer;" onclick="window.location.href='profile.html?id=${u.id}'">
                ${avatar}
                <div>
                    <div style="font-size:14px;font-weight:600;">${u.name || u.username || 'User'}</div>
                    <div style="font-size:11px;color:#94a3b8;">@${u.username || 'user'}</div>
                </div>
            </div>
        `;
    }).join('');
}

// Logout
document.getElementById('logout-btn')?.addEventListener('click', () => {
    localStorage.removeItem('user');
    window.location.href = 'login.html?status=logout';
});