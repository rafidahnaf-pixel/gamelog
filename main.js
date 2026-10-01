// ==========================================
// GAME LOG - FRONTEND SCRIPT (main.js)
// ==========================================

const API_URL = 'http://localhost:3000';
let activePostId = null;

// 1. Check Status Login User
function checkAuthStatus() {
    const user = JSON.parse(localStorage.getItem('user'));
    const formContainer = document.getElementById('post-cta-container');
    const loginPrompt = document.getElementById('login-prompt-card');
    const adminBtn = document.getElementById('admin-menu-btn');
    const authHeader = document.getElementById('auth-header-buttons');

    if (user) {
        if (formContainer) formContainer.style.display = 'flex';
        if (loginPrompt) loginPrompt.style.display = 'none';

        // Sembunyikan tombol Get Started jika sudah login
        const getStartedBtn = document.getElementById('get-started-btn');
        if (getStartedBtn) getStartedBtn.style.display = 'none';

        if (user.role && user.role.toLowerCase() === 'admin' && adminBtn) {
            adminBtn.style.display = 'flex';
        }

        if (authHeader) {
            authHeader.style.display = 'none';
        }
    } else {
        if (formContainer) formContainer.style.display = 'none';
        if (loginPrompt) loginPrompt.style.display = 'block';
    }
}

function handleLogout() {
    localStorage.removeItem('user');
    window.location.href = 'pages/login.html?status=logout';
}

// 2. Formatter Waktu Relatif & Tanggal Dinamis
function formatRelativeTime(dateString) {
    if (!dateString) return 'Baru saja';

    const postDate = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - postDate) / 1000);

    if (isNaN(diffInSeconds) || diffInSeconds < 10) return 'Baru saja';
    if (diffInSeconds < 60) return `${diffInSeconds} detik lalu`;
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes} menit lalu`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} jam lalu`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays} hari lalu`;

    return postDate.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

function formatImageUrl(imagePath) {
    if (!imagePath) return null;
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
        return imagePath;
    }
    const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
    return `${API_URL}${cleanPath}`;
}

function showToast(message) {
    const toast = document.getElementById('toast-notif');
    if (!toast) return;
    toast.innerText = message;
    toast.style.display = 'block';
    setTimeout(() => {
        toast.style.display = 'none';
    }, 2500);
}

// 3. Fetch Games List ke Select Form
async function fetchGamesSelect() {
    const gameSelect = document.getElementById('post-game-id');
    if (!gameSelect) return;

    try {
        const response = await fetch(`${API_URL}/api/games`);
        const games = await response.json();

        gameSelect.innerHTML = '<option value="" disabled selected>-- Pilih Game --</option>';
        games.forEach(game => {
            const option = document.createElement('option');
            option.value = game.id;
            option.textContent = game.title;
            gameSelect.appendChild(option);
        });
    } catch (error) {
        console.error('❌ Gagal mengambil daftar game:', error);
    }
}

// 3.5 Fetch Trending Games
async function fetchTrendingGames() {
    const container = document.getElementById('trending-games-container');
    if (!container) return;

    try {
        const response = await fetch(`${API_URL}/api/games/trending`);
        const games = await response.json();

        if (!Array.isArray(games) || games.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary); font-size: 13px; text-align: center; padding: 20px;">Belum ada game trending.</p>';
            return;
        }

        container.innerHTML = games.map(game => {
            const cover = formatImageUrl(game.cover_url) || `https://placehold.co/260x110/1e293b/818cf8?text=${encodeURIComponent(game.title)}`;
            return `
                <div class="recent-card">
                    <img src="${cover}" alt="${game.title}" onerror="this.src='https://placehold.co/260x110/1e293b/818cf8?text=${encodeURIComponent(game.title)}'">
                    <h3 style="font-size: 14px; margin-top: 5px;">${game.title}</h3>
                    <p style="font-size: 12px; color: var(--text-secondary);">${game.genre || 'Game'} • ❤️ ${game.total_likes || 0}</p>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('❌ Gagal mengambil trending games:', error);
        container.innerHTML = '<p style="color: var(--text-secondary); font-size: 13px; text-align: center; padding: 20px;">Gagal memuat.</p>';
    }
}

// 4. Fetch Posts & Render Feed UI
async function fetchPosts() {
    const feedContainer = document.getElementById('feed-container');
    if (!feedContainer) return;

    try {
        const response = await fetch(`${API_URL}/api/posts`);
        const posts = await response.json();

        const user = JSON.parse(localStorage.getItem('user'));
        let userLikes = [];

        if (user) {
            try {
                const likesRes = await fetch(`${API_URL}/api/users/${user.id}/likes`);
                if (likesRes.ok) {
                    userLikes = await likesRes.json();
                }
            } catch (err) {
                console.error('Gagal mengambil data user likes:', err);
            }
        }

        renderPostsToUI(posts, userLikes);
    } catch (error) {
        console.error('❌ Gagal konek ke server backend:', error);
        feedContainer.innerHTML = '<p style="color: #ef4444; text-align: center;">Gagal memuat postingan.</p>';
    }
}

function renderPostsToUI(posts, userLikes = []) {
    const feedContainer = document.getElementById('feed-container');
    if (!feedContainer) return;

    feedContainer.innerHTML = '';

    if (!posts || posts.length === 0) {
        feedContainer.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">Belum ada postingan terbaru.</p>';
        return;
    }

    posts.forEach(post => {
        const postElement = document.createElement('article');
        postElement.classList.add('post-card');

        const isLiked = Array.isArray(userLikes) && userLikes.includes(post.id);
        const userInitial = (post.username || 'U').charAt(0).toUpperCase();
        
        // Avatar user
        const userAvatar = post.user_avatar 
            ? `<img src="${formatImageUrl(post.user_avatar)}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;" alt="${post.username}">`
            : `<div class="post-user-avatar">${userInitial}</div>`;
        
        const userImageHtml = post.post_image 
            ? `<div class="post-media-container">
                 <img src="${formatImageUrl(post.post_image)}" class="post-media-image" alt="User Screenshot" onerror="this.style.display='none'">
               </div>` 
            : '';

        const gameCover = formatImageUrl(post.game_cover) || 'https://placehold.co/150x150/1e293b/818cf8?text=Game';
        
        const formattedStatus = (post.status || 'playing').toLowerCase().replace(/\s+/g, '-');
        const statusClass = `status-${formattedStatus}`;
        
        // FORMAT WAKTU TANGGAL RELATIF
        const timeDisplay = formatRelativeTime(post.created_at);

        postElement.innerHTML = `
            <div class="post-header">
                <div class="post-user-info">
                    ${userAvatar}
                    <div class="post-user-details">
                        <h3>${post.name || post.username || 'Anonymous'}</h3>
                        <span style="font-size:11px;color:#818cf8;">@${post.username || 'user'}</span>
                        <span>${timeDisplay}</span>
                    </div>
                </div>
                <div class="post-game-badge">
                    <img src="${gameCover}" class="game-mini-cover" alt="${post.game_title}">
                    <span class="game-title-text">${post.game_title || 'Game'}</span>
                </div>
            </div>

            ${userImageHtml}

            <div class="post-body">
                <span class="post-status-tag ${statusClass}">${post.status || 'Playing'}</span>
                <p class="post-caption">
                    <span class="username-bold">${post.name || post.username || 'User'}</span>
                    ${post.content}
                </p>
            </div>

            <div class="post-actions">
                <button type="button" class="action-btn btn-like ${isLiked ? 'liked' : ''}" data-id="${post.id}">
                    <i data-lucide="heart"></i> <span><span class="like-count">${post.total_likes || 0}</span> Likes</span>
                </button>
                <button type="button" class="action-btn btn-comment" data-id="${post.id}">
                    <i data-lucide="message-square"></i> <span>Komentar</span>
                </button>
                <button type="button" class="action-btn btn-share" data-id="${post.id}">
                    <i data-lucide="share-2"></i> <span>Share</span>
                </button>
                <button type="button" class="action-btn btn-report" data-id="${post.id}" style="margin-left:auto;">
                    <i data-lucide="flag"></i> <span>Report</span>
                </button>
            </div>
        `;

        feedContainer.appendChild(postElement);
    });

    if (window.lucide) lucide.createIcons();
}

// 5. Modal Komentar & Share
function openCommentModal(postId) {
    activePostId = postId;
    const modal = document.getElementById('comment-modal');
    if (modal) {
        modal.classList.add('active');
        loadComments(postId);
    }
}

function closeCommentModal() {
    const modal = document.getElementById('comment-modal');
    if (modal) {
        modal.classList.remove('active');
        activePostId = null;
    }
}

async function loadComments(postId) {
    const list = document.getElementById('comments-list');
    if (!list) return;
    list.innerHTML = '<p style="color: #aaa; text-align: center;">Memuat komentar...</p>';

    try {
        const res = await fetch(`${API_URL}/api/posts/${postId}/comments`);
        const comments = await res.json();

        if (!Array.isArray(comments) || comments.length === 0) {
            list.innerHTML = '<p style="color: #aaa; text-align: center;">Belum ada komentar.</p>';
            return;
        }

        list.innerHTML = comments.map(c => {
            const commentTime = formatRelativeTime(c.created_at);
            return `
                <div class="comment-item">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
                        <span class="comment-user">${c.username || 'User'}</span>
                        <span style="font-size: 10px; color: #94a3b8;">${commentTime}</span>
                    </div>
                    <div>${c.comment}</div>
                </div>
            `;
        }).join('');
    } catch (err) {
        list.innerHTML = '<p style="color: #ef4444; text-align: center;">Gagal memuat komentar.</p>';
    }
}

function sharePost(postId) {
    const postUrl = `${window.location.origin}/home.html#post-${postId}`;

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(postUrl).then(() => {
            showToast('Link postingan berhasil disalin!');
        }).catch(() => {
            fallbackCopy(postUrl);
        });
    } else {
        fallbackCopy(postUrl);
    }
}

function fallbackCopy(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
        document.execCommand('copy');
        showToast('Link postingan berhasil disalin!');
    } catch (err) {
        showToast('Gagal menyalin link.');
    }
    document.body.removeChild(textArea);
}

async function toggleLike(button, postId) {
    const user = JSON.parse(localStorage.getItem('user'));

    if (!user) {
        alert('Silakan login terlebih dahulu untuk menyukai postingan!');
        return;
    }

    const countSpan = button.querySelector('.like-count');
    let currentLikes = parseInt(countSpan ? countSpan.textContent : '0', 10);

    try {
        const response = await fetch(`${API_URL}/api/posts/${postId}/like`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: user.id })
        });

        const data = await response.json();

        if (response.ok) {
            if (data.liked) {
                button.classList.add('liked');
                currentLikes += 1;
            } else {
                button.classList.remove('liked');
                currentLikes -= 1;
            }
            if (countSpan) countSpan.textContent = currentLikes;
        } else {
            alert(data.message || 'Gagal memproses like');
        }
    } catch (error) {
        console.error('Error saat like:', error);
    }
}

// Inisialisasi Utama
document.addEventListener('DOMContentLoaded', () => {
    checkAuthStatus();
    fetchGamesSelect();
    fetchTrendingGames();
    fetchPosts();

    const feedContainer = document.getElementById('feed-container');
    if (feedContainer) {
        feedContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.action-btn');
            if (!btn) return;

            const postId = btn.getAttribute('data-id');
            if (!postId) return;

            if (btn.classList.contains('btn-like')) {
                toggleLike(btn, postId);
            } else if (btn.classList.contains('btn-comment')) {
                openCommentModal(postId);
            } else if (btn.classList.contains('btn-share')) {
                sharePost(postId);
            } else if (btn.classList.contains('btn-report')) {
                openReportModal(postId);
            }
        });
    }

    document.getElementById('close-modal-btn')?.addEventListener('click', closeCommentModal);

    const modal = document.getElementById('comment-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeCommentModal();
        });
    }

    // Report functionality
    let reportPostId = null;

    function openReportModal(postId) {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user) {
            alert('Silakan login terlebih dahulu untuk melaporkan postingan!');
            return;
        }
        reportPostId = postId;
        const reportModal = document.getElementById('report-modal');
        if (reportModal) reportModal.classList.add('active');
    }

    document.getElementById('close-report-modal')?.addEventListener('click', () => {
        document.getElementById('report-modal')?.classList.remove('active');
        reportPostId = null;
    });

    document.getElementById('report-modal')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('report-modal')) {
            document.getElementById('report-modal').classList.remove('active');
            reportPostId = null;
        }
    });

    document.getElementById('report-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!reportPostId) return;

        const currentUser = JSON.parse(localStorage.getItem('user'));
        if (!currentUser) {
            alert('Silakan login terlebih dahulu!');
            return;
        }

        const reason = document.getElementById('report-reason').value;
        const description = document.getElementById('report-description').value;

        if (!reason) {
            alert('Pilih alasan laporan terlebih dahulu!');
            return;
        }

        try {
            const res = await fetch(`${API_URL}/api/reports`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reporter_id: currentUser.id,
                    post_id: reportPostId,
                    reason,
                    description
                })
            });

            if (res.ok) {
                showToast('Laporan berhasil dikirim!');
                document.getElementById('report-modal').classList.remove('active');
                document.getElementById('report-form').reset();
                reportPostId = null;
            } else {
                const data = await res.json();
                alert(data.message || 'Gagal mengirim laporan');
            }
        } catch (err) {
            console.error('Error submitting report:', err);
            alert('Gagal mengirim laporan');
        }
    });

    document.getElementById('comment-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const currentUser = JSON.parse(localStorage.getItem('user'));
        if (!currentUser) {
            window.location.href = 'pages/login.html';
            return;
        }

        const input = document.getElementById('comment-input');
        const comment = input.value.trim();
        if (!comment || !activePostId) return;

        try {
            const res = await fetch(`${API_URL}/api/posts/${activePostId}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: currentUser.id, comment })
            });

            if (res.ok) {
                input.value = '';
                loadComments(activePostId);
            }
        } catch (err) {
            console.error('Error submitting comment:', err);
        }
    });
});