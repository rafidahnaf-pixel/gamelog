// ==========================================
// GAMELOG - SHARED SIDEBAR (sidebar.js)
// Render sidebar berbeda berdasarkan role user
// ==========================================
(function () {
    const user = JSON.parse(localStorage.getItem('user'));
    const isAdmin = user && user.role && user.role.toLowerCase() === 'admin';

    // Detect path: root vs pages folder
    const isInPages = window.location.pathname.includes('/pages/');
    const base = isInPages ? '../' : '';

    // Current page filename untuk active state
    const currentPage = window.location.pathname.split('/').pop();

    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    function isActive(page) {
        return currentPage === page ? 'active' : '';
    }

    if (isAdmin) {
        // ========== ADMIN SIDEBAR ==========
        // Tidak ada Home, Search, Profile, dll.
        document.body.classList.add('admin-mode');
        sidebar.innerHTML = `
            <h2>
                <i data-lucide="gamepad-2"></i>
                <span>GameLog</span>
            </h2>
            <a href="${base}pages/admin.html" class="${isActive('admin.html')}">
                <i data-lucide="shield-check"></i> <span>Dashboard</span>
            </a>
            <a href="${base}pages/admin-games.html" class="${isActive('admin-games.html')}">
                <i data-lucide="gamepad-2"></i> <span>Manajemen Game</span>
            </a>
            <a href="${base}pages/admin-users.html" class="${isActive('admin-users.html')}">
                <i data-lucide="users"></i> <span>Manajemen User</span>
            </a>
            <a href="${base}pages/admin-posts.html" class="${isActive('admin-posts.html')}">
                <i data-lucide="file-text"></i> <span>Moderasi Postingan</span>
            </a>
            <a href="${base}pages/admin-feedbacks.html" class="${isActive('admin-feedbacks.html')}">
                <i data-lucide="mail"></i> <span>Feedback</span>
            </a>
            <a href="${base}pages/admin-reports.html" class="${isActive('admin-reports.html')}">
                <i data-lucide="flag"></i> <span>Reports</span>
            </a>
            <a href="#" id="sidebar-logout-btn" style="color: #ef4444; margin-top: 20px;">
                <i data-lucide="log-out"></i> <span>Logout</span>
            </a>
        `;
    } else {
        // ========== USER SIDEBAR ==========
        sidebar.innerHTML = `
            <h2>
                <i data-lucide="gamepad-2"></i>
                <span>GameLog</span>
            </h2>
            <a href="${base}home.html" class="${isActive('home.html')}">
                <i data-lucide="home"></i> <span>Home</span>
            </a>
            <a href="${base}pages/post.html" class="${isActive('post.html')}">
                <i data-lucide="plus-circle"></i> <span>Create</span>
            </a>
            <a href="${base}pages/search.html" class="${isActive('search.html')}">
                <i data-lucide="search"></i> <span>Search</span>
            </a>
            <a href="${base}pages/notification.html" class="${isActive('notification.html')}">
                <i data-lucide="bell"></i> <span>Notification</span>
                <span class="notif-badge" id="notif-badge" style="display:none; background:#ef4444; color:#fff; font-size:10px; padding:2px 6px; border-radius:10px; margin-left:auto;">0</span>
            </a>
            <a href="${base}pages/profile.html" class="${isActive('profile.html')}">
                <i data-lucide="user"></i> <span>Profile</span>
            </a>
            ${isAdmin ? `
            <a href="${base}pages/admin.html" style="color: #f59e0b;" class="${isActive('admin.html')}">
                <i data-lucide="shield-alert"></i> <span>Admin Panel</span>
            </a>
            ` : ''}
        `;
    }

    // Re-initialize Lucide icons
    if (window.lucide) lucide.createIcons();

    // Jarakin tombol Profile dari menu lain (selalu, baik login atau tidak)
    const profileLink = sidebar.querySelector('a[href$="profile.html"]');
    if (profileLink) {
        profileLink.style.marginTop = '30px';
    }

    // Ganti icon Profile di sidebar dengan avatar user (hanya jika login)
    if (user && user.id) {
        if (profileLink) {
            const iconHtml = user.avatar 
                ? `<img src="${user.avatar}" alt="${user.username}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;">`
                : `<i data-lucide="user"></i>`;
            profileLink.innerHTML = `${iconHtml} <span>Profile</span>`;
        }
    }

    // Handle logout dari sidebar
    const logoutBtn = document.getElementById('sidebar-logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function (e) {
            e.preventDefault();
            localStorage.removeItem('user');
            window.location.href = base + 'pages/login.html?status=logout';
        });
    }

    // Fetch unread notification count untuk user
    if (user && user.id) {
        const fetchNotifCount = () => {
            fetch(`/api/notifications/unread-count?user_id=${user.id}`)
                .then(res => res.json())
                .then(data => {
                    const badge = document.getElementById('notif-badge');
                    if (badge) {
                        if (data.total > 0) {
                            badge.textContent = data.total > 99 ? '99+' : data.total;
                            badge.style.display = 'inline-block';
                        } else {
                            badge.style.display = 'none';
                        }
                    }
                })
                .catch(() => {});
        };

        // Fetch langsung saat load
        fetchNotifCount();
        
        // Polling tiap 10 detik untuk update otomatis
        setInterval(fetchNotifCount, 10000);
    }
})();
