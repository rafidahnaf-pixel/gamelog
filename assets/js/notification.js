const API_URL = '';

// Cek user login
const currentUser = JSON.parse(localStorage.getItem('user'));
if (!currentUser) {
    document.querySelector('.notification-list').innerHTML = 
        '<p style="text-align:center;color:#94a3b8;padding:30px;">Silakan login untuk melihat notifikasi.</p>';
} else {
    loadNotifications();
}

async function loadNotifications() {
    const listContainer = document.querySelector('.notification-list');
    listContainer.innerHTML = '<p style="text-align:center;color:#94a3b8;padding:30px;">Memuat notifikasi...</p>';

    try {
        const res = await fetch(`${API_URL}/api/notifications?user_id=${currentUser.id}`);
        const notifications = await res.json();

        if (!Array.isArray(notifications) || notifications.length === 0) {
            listContainer.innerHTML = '<p style="text-align:center;color:#94a3b8;padding:30px;">Belum ada notifikasi.</p>';
            return;
        }

        listContainer.innerHTML = notifications.map(n => {
            const timeAgo = formatRelativeTime(n.created_at);
            const icon = getNotificationIcon(n.type);
            const unreadClass = n.is_read ? '' : 'unread';
            
            return `
                <div class="notification ${unreadClass}" data-id="${n.id}" onclick="markAsRead(${n.id})">
                    <div class="notification-icon">${icon}</div>
                    <div class="notification-content">
                        <h3>${n.type === 'like' ? 'Postingan Disukai' : 'Komentar Baru'}</h3>
                        <p>${n.message}</p>
                        <span>${timeAgo}</span>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        listContainer.innerHTML = '<p style="text-align:center;color:#ef4444;padding:30px;">Gagal memuat notifikasi.</p>';
    }
}

function getNotificationIcon(type) {
    switch(type) {
        case 'like': return '❤️';
        case 'comment': return '💬';
        case 'game_added': return '🎮';
        default: return '🔔';
    }
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

async function markAsRead(id) {
    try {
        await fetch(`${API_URL}/api/notifications/${id}/read`, { method: 'PUT' });
        const notif = document.querySelector(`.notification[data-id="${id}"]`);
        if (notif) notif.classList.remove('unread');
    } catch (err) {
        console.error('Gagal menandai notifikasi:', err);
    }
}

// Mark all as read button
const markAllBtn = document.querySelector('.mark-read');
if (markAllBtn) {
    markAllBtn.addEventListener('click', async () => {
        try {
            await fetch(`${API_URL}/api/notifications/read-all`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: currentUser.id })
            });
            document.querySelectorAll('.notification.unread').forEach(el => el.classList.remove('unread'));
        } catch (err) {
            console.error('Gagal menandai semua notifikasi:', err);
        }
    });
}