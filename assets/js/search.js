lucide.createIcons();

const API_URL = 'http://localhost:3000';
let allPosts = [];
let selectedStatus = 'ALL';
let userLikes = [];
let activePostId = null;

// 1. Check Auth & Admin Status
const user = JSON.parse(localStorage.getItem('user'));
function checkAdminStatus() {
    const adminBtn = document.getElementById('admin-menu-btn');
    if (user && user.role && user.role.toLowerCase() === 'admin' && adminBtn) {
        adminBtn.style.display = 'flex';
    }
}

// 2. Helper Formatter Waktu & Gambar
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
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
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

// 3. Load Data Posts & User Likes
async function loadSearchData() {
    const container = document.getElementById('search-results-container');
    try {
        if (user) {
            try {
                const likesRes = await fetch(`${API_URL}/api/users/${user.id}/likes`);
                if (likesRes.ok) userLikes = await likesRes.json();
            } catch (err) { console.error('Error likes:', err); }
        }

        const res = await fetch(`${API_URL}/api/posts`);
        if (res.ok) {
            allPosts = await res.json();
            filterAndRenderPosts();
        } else {
            container.innerHTML = '<p style="color: #ef4444; text-align: center;">Gagal memuat postingan.</p>';
        }
    } catch (err) {
        console.error('Error load search:', err);
        container.innerHTML = '<p style="color: #ef4444; text-align: center;">Gagal terhubung ke server backend.</p>';
    }
}

// 4. Filter & Render
function filterAndRenderPosts() {
    const searchInput = document.getElementById('main-search-input');
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const summaryText = document.getElementById('results-summary');

    let filtered = allPosts.filter(post => {
        const matchText = 
            (post.username && post.username.toLowerCase().includes(query)) ||
            (post.game_title && post.game_title.toLowerCase().includes(query)) ||
            (post.content && post.content.toLowerCase().includes(query));

        const matchStatus = selectedStatus === 'ALL' || 
            (post.status && post.status.toLowerCase() === selectedStatus.toLowerCase());

        return matchText && matchStatus;
    });

    if (summaryText) {
        if (query || selectedStatus !== 'ALL') {
            summaryText.textContent = `Ditemukan ${filtered.length} postingan yang cocok`;
        } else {
            summaryText.textContent = `Menampilkan semua postingan terbaru (${filtered.length})`;
        }
    }

    renderSearchResults(filtered);
}

function renderSearchResults(posts) {
    const container = document.getElementById('search-results-container');
    container.innerHTML = '';

    if (!posts || posts.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: #94a3b8;">
                <i data-lucide="search-x" style="width: 48px; height: 48px; margin-bottom: 12px; opacity: 0.5;"></i>
                <p>Tidak ditemukan postingan yang cocok dengan pencarian kamu.</p>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
        return;
    }

    posts.forEach(post => {
        const article = document.createElement('article');
        article.classList.add('post-card');

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
        const timeDisplay = formatRelativeTime(post.created_at);

        article.innerHTML = `
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

            <!-- LENGKAP: TOMBOL LIKE, KOMENTAR, SHARE -->
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
            </div>
        `;

        container.appendChild(article);
    });

    if (window.lucide) lucide.createIcons();
}

// 5. Logika Interaksi (Like, Komentar, Share)
async function toggleLike(button, postId) {
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
                if (!userLikes.includes(parseInt(postId))) userLikes.push(parseInt(postId));
            } else {
                button.classList.remove('liked');
                currentLikes -= 1;
                userLikes = userLikes.filter(id => id !== parseInt(postId));
            }
            if (countSpan) countSpan.textContent = currentLikes;
        } else {
            alert(data.message || 'Gagal memproses like');
        }
    } catch (error) {
        console.error('Error saat like:', error);
    }
}

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

        list.innerHTML = comments.map(c => `
            <div class="comment-item">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px;">
                    <span class="comment-user">${c.username || 'User'}</span>
                    <span style="font-size:10px; color:#94a3b8;">${formatRelativeTime(c.created_at)}</span>
                </div>
                <div>${c.comment}</div>
            </div>
        `).join('');
    } catch (err) {
        list.innerHTML = '<p style="color: #ef4444; text-align: center;">Gagal memuat komentar.</p>';
    }
}

function sharePost(postId) {
    const postUrl = `${window.location.origin}/home.html#post-${postId}`;
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(postUrl).then(() => {
            showToast('Link postingan berhasil disalin!');
        }).catch(() => fallbackCopy(postUrl));
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

// 6. Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    checkAdminStatus();
    loadSearchData();

    const searchInput = document.getElementById('main-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', filterAndRenderPosts);
    }

    const chips = document.querySelectorAll('.filter-chip');
    chips.forEach(chip => {
        chip.addEventListener('click', (e) => {
            chips.forEach(c => c.classList.remove('active'));
            e.target.classList.add('active');
            selectedStatus = e.target.getAttribute('data-status');
            filterAndRenderPosts();
        });
    });

    // Event Delegation untuk tombol Like, Comment, dan Share di Feed
    const container = document.getElementById('search-results-container');
    if (container) {
        container.addEventListener('click', (e) => {
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
            }
        });
    }

    // Handlers Modal Komentar
    document.getElementById('close-modal-btn')?.addEventListener('click', closeCommentModal);

    const modal = document.getElementById('comment-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeCommentModal();
        });
    }

    document.getElementById('comment-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!user) {
            window.location.href = 'login.html';
            return;
        }

        const input = document.getElementById('comment-input');
        const comment = input.value.trim();
        if (!comment || !activePostId) return;

        try {
            const res = await fetch(`${API_URL}/api/posts/${activePostId}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id, comment })
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