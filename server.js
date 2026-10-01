const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const bcrypt = require('bcrypt');

const app = express();
const PORT = 3000;

// Middleware Wajib
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// Buat folder 'uploads' otomatis jika belum tersedia
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Akses Folder 'uploads' secara Publik
app.use('/uploads', express.static(uploadDir));

// Konfigurasi Storage Multer untuk Upload Foto
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Koneksi Database MySQL dengan auto-reconnect
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gamelog_db',
    port: process.env.DB_PORT || 3306,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
};

const db = mysql.createConnection(dbConfig);

function handleDisconnect() {
    db.connect((err) => {
        if (err) {
            console.error('❌ Koneksi database gagal:', err.message);
            setTimeout(handleDisconnect, 2000);
        } else {
            console.log('✅ Terhubung ke Database MySQL!');
        }
    });

    db.on('error', (err) => {
        console.error('❌ Database Runtime Error:', err.message);
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
            handleDisconnect();
        } else {
            throw err;
        }
    });
}

handleDisconnect();

// ==========================================
// ENDPOINT AUTHENTICATION
// ==========================================

// 1. REGISTER
app.post('/api/register', async (req, res) => {
    try {
        let { username, email, password } = req.body;
        username = username ? username.toString().trim() : '';
        email = email ? email.toString().trim() : '';
        password = password ? password.toString().trim() : '';

        // Validasi
        if (!username || !email || !password) {
            return res.status(400).json({ message: 'Username, Email, dan Password wajib diisi!' });
        }

        if (username.length < 3) {
            return res.status(400).json({ message: 'Username minimal 3 karakter!' });
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ message: 'Format email tidak valid!' });
        }

        if (password.length < 6) {
            return res.status(400).json({ message: 'Password minimal 6 karakter!' });
        }

        // Cek username sudah ada
        const checkQuery = 'SELECT * FROM users WHERE TRIM(username) = ?';
        db.query(checkQuery, [username], async (err, results) => {
            if (err) return res.status(500).json({ error: err.message });

            if (results.length > 0) {
                return res.status(400).json({ message: 'Username sudah digunakan!' });
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);

            const insertQuery = "INSERT INTO users (username, email, password, role, is_banned) VALUES (?, ?, ?, 'user', 0)";
            db.query(insertQuery, [username, email, hashedPassword], (err, result) => {
                if (err) return res.status(500).json({ error: err.message });

                res.status(201).json({
                    message: 'Registrasi berhasil! Silakan login.',
                    userId: result.insertId
                });
            });
        });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ message: 'Terjadi kesalahan server!' });
    }
});

// 2. LOGIN (DILENGKAPI CEK BANNED)
app.post('/api/login', (req, res) => {
    try {
        let { username, password } = req.body;
        username = username ? username.toString().trim() : '';
        password = password ? password.toString().trim() : '';

        if (!username || !password) {
            return res.status(400).json({ message: 'Username dan password wajib diisi!' });
        }

        const query = 'SELECT id, username, role, is_banned, password FROM users WHERE TRIM(username) = ?';
        db.query(query, [username], async (err, results) => {
            if (err) return res.status(500).json({ error: err.message });

            if (results.length === 0) {
                return res.status(401).json({ 
                    message: 'Akun belum terdaftar atau password Anda salah!' 
                });
            }

            const user = results[0];

            // Verifikasi password dengan bcrypt
            const passwordMatch = await bcrypt.compare(password, user.password);
            if (!passwordMatch) {
                return res.status(401).json({ 
                    message: 'Akun belum terdaftar atau password Anda salah!' 
                });
            }

            // Cek apakah user dalam status Banned
            if (user.is_banned === 1) {
                return res.status(403).json({ 
                    message: 'Akun Anda telah di-banned oleh Admin karena pelanggaran!' 
                });
            }

            res.json({
                message: 'Login berhasil!',
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role
                }
            });
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: 'Terjadi kesalahan server!' });
    }
});

// 3. TOTAL USERS (Untuk Dashboard Admin)
app.get('/api/users/count', (req, res) => {
    db.query('SELECT COUNT(*) AS total FROM users', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ total: results[0].total });
    });
});

// ==========================================
// ENDPOINT GAMES (MANAGEMENT BY ADMIN)
// ==========================================

// Ambil Semua List Game (Sorted by ID ASC)
app.get('/api/games', (req, res) => {
    const query = 'SELECT id, title, genre, cover_url FROM games ORDER BY id ASC';
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Tambah Game Baru
app.post('/api/games', upload.single('cover'), (req, res) => {
    const { title, genre, cover_url: inputCoverUrl } = req.body;

    if (!title) {
        return res.status(400).json({ message: 'Judul game wajib diisi!' });
    }

    let finalCoverUrl = inputCoverUrl || null;
    if (req.file) {
        finalCoverUrl = `/uploads/${req.file.filename}`;
    }

    const insertQuery = 'INSERT INTO games (title, genre, cover_url) VALUES (?, ?, ?)';
    db.query(insertQuery, [title, genre || 'Game', finalCoverUrl], (err, result) => {
        if (err) {
            console.error('❌ Error Insert Game:', err.message);
            return res.status(500).json({ error: err.message });
        }

        res.status(201).json({
            message: 'Game berhasil ditambahkan!',
            gameId: result.insertId
        });
    });
});

// Hapus Game
app.delete('/api/games/:id', (req, res) => {
    const gameId = req.params.id;

    db.query('SELECT id FROM posts WHERE game_id = ?', [gameId], (err, posts) => {
        if (err) return res.status(500).json({ error: err.message });

        const postIds = posts.map(p => p.id);

        const deleteGameStep = () => {
            db.query('DELETE FROM posts WHERE game_id = ?', [gameId], (err) => {
                if (err) return res.status(500).json({ error: err.message });

                db.query('DELETE FROM games WHERE id = ?', [gameId], (err, result) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ message: 'Game dan semua postingan terkait berhasil dihapus!' });
                });
            });
        };

        if (postIds.length > 0) {
            db.query('DELETE FROM likes WHERE post_id IN (?)', [postIds], () => {
                db.query('DELETE FROM comments WHERE post_id IN (?)', [postIds], () => {
                    deleteGameStep();
                });
            });
        } else {
            deleteGameStep();
        }
    });
});

// ==========================================
// ENDPOINT POSTS
// ==========================================

// Fetch Posts (TERMASUK TIMESTAMP created_at)
app.get('/api/posts', (req, res) => {
    const query = `
        SELECT 
            posts.id,
            posts.content,
            posts.status,
            posts.post_image,
            posts.created_at,
            users.username,
            users.name,
            users.avatar AS user_avatar,
            games.title AS game_title,
            games.cover_url AS game_cover,
            COALESCE(COUNT(likes.id), 0) AS total_likes
        FROM posts
        JOIN users ON posts.user_id = users.id
        JOIN games ON posts.game_id = games.id
        LEFT JOIN likes ON posts.id = likes.post_id
        GROUP BY posts.id, users.username, users.name, users.avatar, games.title, games.cover_url, posts.created_at
        ORDER BY posts.id DESC
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('❌ Error Fetch Posts:', err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

// Create Post
app.post('/api/posts', upload.single('image'), (req, res) => {
    const { user_id, game_id, content, status } = req.body;

    if (!user_id || !game_id || !content) {
        return res.status(400).json({ message: 'Data postingan tidak lengkap!' });
    }

    let post_image = null;
    if (req.file) {
        post_image = `/uploads/${req.file.filename}`;
    }

    const insertQuery = 'INSERT INTO posts (user_id, game_id, content, status, post_image) VALUES (?, ?, ?, ?, ?)';
    db.query(insertQuery, [user_id, game_id, content, status || 'Playing', post_image], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });

        res.status(201).json({
            message: 'Postingan berhasil diterbitkan!',
            postId: result.insertId
        });
    });
});

// Hapus Postingan
app.delete('/api/posts/:id', (req, res) => {
    const postId = req.params.id;

    db.query('DELETE FROM likes WHERE post_id = ?', [postId], (err) => {
        if (err) return res.status(500).json({ error: err.message });

        db.query('DELETE FROM comments WHERE post_id = ?', [postId], (err) => {
            if (err) return res.status(500).json({ error: err.message });

            db.query('DELETE FROM posts WHERE id = ?', [postId], (err, result) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Postingan berhasil dihapus!' });
            });
        });
    });
});

// ==========================================
// ENDPOINT LIKES & COMMENTS
// ==========================================

app.post('/api/posts/:id/like', (req, res) => {
    const postId = req.params.id;
    const { user_id } = req.body;

    if (!user_id) return res.status(400).json({ message: 'User ID wajib dikirim!' });

    const checkLike = 'SELECT * FROM likes WHERE user_id = ? AND post_id = ?';
    db.query(checkLike, [user_id, postId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        if (results.length > 0) {
            db.query('DELETE FROM likes WHERE user_id = ? AND post_id = ?', [user_id, postId], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Unlike berhasil', liked: false });
            });
        } else {
            db.query('INSERT INTO likes (user_id, post_id) VALUES (?, ?)', [user_id, postId], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                
                // Buat notifikasi ke pemilik post
                db.query('SELECT user_id FROM posts WHERE id = ?', [postId], (err, postResults) => {
                    if (!err && postResults.length > 0 && postResults[0].user_id !== user_id) {
                        db.query('SELECT username FROM users WHERE id = ?', [user_id], (err, userResults) => {
                            if (!err && userResults.length > 0) {
                                const message = `${userResults[0].username} menyukai postinganmu`;
                                db.query('INSERT INTO notifications (user_id, type, message, related_id) VALUES (?, ?, ?, ?)', 
                                    [postResults[0].user_id, 'like', message, postId]);
                            }
                        });
                    }
                });
                
                res.json({ message: 'Like berhasil', liked: true });
            });
        }
    });
});

app.get('/api/users/:userId/likes', (req, res) => {
    const userId = req.params.userId;
    db.query('SELECT post_id FROM likes WHERE user_id = ?', [userId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results.map(row => row.post_id));
    });
});

app.get('/api/posts/:postId/comments', (req, res) => {
    const { postId } = req.params;
    const query = `
        SELECT comments.id, comments.comment, comments.created_at, users.username
        FROM comments
        JOIN users ON comments.user_id = users.id
        WHERE comments.post_id = ?
        ORDER BY comments.id ASC
    `;
    db.query(query, [postId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.post('/api/posts/:postId/comments', (req, res) => {
    const { postId } = req.params;
    const { user_id, comment } = req.body;

    if (!user_id || !comment || !comment.trim()) {
        return res.status(400).json({ message: 'Komentar tidak boleh kosong!' });
    }

    db.query('INSERT INTO comments (post_id, user_id, comment) VALUES (?, ?, ?)', [postId, user_id, comment.trim()], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // Buat notifikasi ke pemilik post
        db.query('SELECT user_id FROM posts WHERE id = ?', [postId], (err, postResults) => {
            if (!err && postResults.length > 0 && postResults[0].user_id !== user_id) {
                db.query('SELECT username FROM users WHERE id = ?', [user_id], (err, userResults) => {
                    if (!err && userResults.length > 0) {
                        const message = `${userResults[0].username} mengomentari postinganmu`;
                        db.query('INSERT INTO notifications (user_id, type, message, related_id) VALUES (?, ?, ?, ?)', 
                            [postResults[0].user_id, 'comment', message, postId]);
                    }
                });
            }
        });
        
        res.status(201).json({ message: 'Komentar berhasil ditambahkan!', commentId: result.insertId });
    });
});

// ==========================================
// ENDPOINT BANNED USER & FEEDBACKS (ADMIN)
// ==========================================

// 1. Ambil Semua User (untuk Admin Panel)
app.get('/api/users', (req, res) => {
    db.query('SELECT id, username, role, is_banned FROM users ORDER BY id ASC', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// 2. Toggle Ban / Unban User
app.put('/api/users/:id/ban', (req, res) => {
    const userId = req.params.id;
    const { is_banned } = req.body;

    db.query('UPDATE users SET is_banned = ? WHERE id = ?', [is_banned, userId], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: `Status ban user berhasil diperbarui.` });
    });
});

// 3. Kirim Feedback / Request Game dari User
app.post('/api/feedbacks', (req, res) => {
    const { user_id, post_id, message } = req.body;
    if (!user_id || !message) return res.status(400).json({ message: 'Pesan feedback wajib diisi!' });

    const query = 'INSERT INTO feedbacks (user_id, post_id, message) VALUES (?, ?, ?)';
    db.query(query, [user_id, post_id || null, message], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: 'Feedback berhasil dikirim ke Admin!' });
    });
});

// 4. Ambil Semua Feedback (untuk Admin Panel)
app.get('/api/feedbacks', (req, res) => {
    const query = `
        SELECT feedbacks.id, feedbacks.message, feedbacks.created_at, feedbacks.post_id, users.username 
        FROM feedbacks 
        JOIN users ON feedbacks.user_id = users.id 
        ORDER BY feedbacks.id DESC
    `;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// 5. Hapus Feedback
app.delete('/api/feedbacks/:id', (req, res) => {
    db.query('DELETE FROM feedbacks WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Feedback berhasil dihapus.' });
    });
});

// ==========================================
// ENDPOINT REPORTS
// ==========================================

// Buat report
app.post('/api/reports', (req, res) => {
    const { reporter_id, post_id, reason, description } = req.body;
    
    if (!reporter_id || !post_id || !reason) {
        return res.status(400).json({ message: 'Data report tidak lengkap!' });
    }

    const query = 'INSERT INTO reports (reporter_id, post_id, reason, description) VALUES (?, ?, ?, ?)';
    db.query(query, [reporter_id, post_id, reason, description || ''], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: 'Report berhasil dikirim!' });
    });
});

// Ambil semua reports (untuk admin)
app.get('/api/reports', (req, res) => {
    const query = `
        SELECT reports.id, reports.reason, reports.description, reports.created_at, reports.status,
               reporter.username AS reporter_name, 
               poster.username AS poster_name,
               posts.content AS post_content
        FROM reports
        JOIN users reporter ON reports.reporter_id = reporter.id
        JOIN posts ON reports.post_id = posts.id
        JOIN users poster ON posts.user_id = poster.id
        ORDER BY reports.id DESC
    `;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Update status report (admin)
app.put('/api/reports/:id/status', (req, res) => {
    const { status } = req.body;
    db.query('UPDATE reports SET status = ? WHERE id = ?', [status, req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Status report diperbarui!' });
    });
});

// ==========================================
// ENDPOINT STATISTICS
// ==========================================

app.get('/api/stats', (req, res) => {
    const queries = {
        users: 'SELECT COUNT(*) AS total FROM users',
        games: 'SELECT COUNT(*) AS total FROM games',
        posts: 'SELECT COUNT(*) AS total FROM posts',
        likes: 'SELECT COUNT(*) AS total FROM likes',
        comments: 'SELECT COUNT(*) AS total FROM comments',
        feedbacks: 'SELECT COUNT(*) AS total FROM feedbacks'
    };

    const results = {};
    let completed = 0;
    const total = Object.keys(queries).length;

    Object.keys(queries).forEach(key => {
        db.query(queries[key], (err, rows) => {
            if (err) {
                results[key] = 0;
            } else {
                results[key] = rows[0].total;
            }
            completed++;
            if (completed === total) {
                res.json(results);
            }
        });
    });
});

// ==========================================
// ENDPOINT TRENDING GAMES
// ==========================================

app.get('/api/games/trending', (req, res) => {
    const query = `
        SELECT 
            games.id,
            games.title,
            games.genre,
            games.cover_url,
            COALESCE(COUNT(DISTINCT posts.id), 0) AS total_posts,
            COALESCE(COUNT(likes.id), 0) AS total_likes
        FROM games
        LEFT JOIN posts ON games.id = posts.game_id
        LEFT JOIN likes ON posts.id = likes.post_id
        GROUP BY games.id, games.title, games.genre, games.cover_url
        ORDER BY total_likes DESC, total_posts DESC
        LIMIT 3
    `;
    
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// ==========================================
// ENDPOINT NOTIFICATIONS
// ==========================================

// Ambil notifikasi user
app.get('/api/notifications', (req, res) => {
    const userId = req.query.user_id;
    if (!userId) return res.status(400).json({ message: 'User ID wajib dikirim!' });

    const query = 'SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 50';
    db.query(query, [userId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Tandai notifikasi sudah dibaca
app.put('/api/notifications/:id/read', (req, res) => {
    db.query('UPDATE notifications SET is_read = 1 WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Notifikasi ditandai sudah dibaca.' });
    });
});

// Tandai semua notifikasi sudah dibaca
app.put('/api/notifications/read-all', (req, res) => {
    const userId = req.body.user_id;
    if (!userId) return res.status(400).json({ message: 'User ID wajib dikirim!' });

    db.query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [userId], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Semua notifikasi ditandai sudah dibaca.' });
    });
});

// Hitung notifikasi belum dibaca
app.get('/api/notifications/unread-count', (req, res) => {
    const userId = req.query.user_id;
    if (!userId) return res.status(400).json({ message: 'User ID wajib dikirim!' });

    db.query('SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND is_read = 0', [userId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ total: results[0].total });
    });
});

// ==========================================
// ENDPOINT USER PROFILE & POSTS
// ==========================================

// Update profile user
app.put('/api/users/:id/profile', upload.single('avatar'), (req, res) => {
    const userId = req.params.id;
    const { name, username, email, bio } = req.body;
    
    let avatarUrl = null;
    if (req.file) {
        avatarUrl = `/uploads/${req.file.filename}`;
    }
    
    let query = 'UPDATE users SET name = ?, username = ?, email = ?, bio = ?';
    let params = [name || '', username || '', email || '', bio || ''];
    
    if (avatarUrl) {
        query += ', avatar = ?';
        params.push(avatarUrl);
    }
    
    query += ' WHERE id = ?';
    params.push(userId);
    
    db.query(query, params, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Profile berhasil diperbarui!' });
    });
});

// Ambil postingan user tertentu
app.get('/api/users/:id/posts', (req, res) => {
    const userId = req.params.id;
    const query = `
        SELECT 
            posts.id,
            posts.content,
            posts.status,
            posts.post_image,
            posts.created_at,
            users.username,
            users.name,
            users.avatar AS user_avatar,
            games.title AS game_title,
            games.cover_url AS game_cover,
            COALESCE(COUNT(likes.id), 0) AS total_likes
        FROM posts
        JOIN users ON posts.user_id = users.id
        JOIN games ON posts.game_id = games.id
        LEFT JOIN likes ON posts.id = likes.post_id
        WHERE posts.user_id = ?
        GROUP BY posts.id, users.username, users.name, users.avatar, games.title, games.cover_url, posts.created_at
        ORDER BY posts.id DESC
    `;
    
    db.query(query, [userId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Ganti password user
app.put('/api/users/:id/password', async (req, res) => {
    try {
        const userId = req.params.id;
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Password lama dan baru wajib diisi!' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ message: 'Password baru minimal 6 karakter!' });
        }

        // Cek password lama
        db.query('SELECT password FROM users WHERE id = ?', [userId], async (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            if (results.length === 0) return res.status(404).json({ message: 'User tidak ditemukan' });

            const passwordMatch = await bcrypt.compare(currentPassword, results[0].password);
            if (!passwordMatch) {
                return res.status(400).json({ message: 'Password lama salah!' });
            }

            // Hash password baru
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Password berhasil diubah!' });
            });
        });
    } catch (err) {
        console.error('Ganti password error:', err);
        res.status(500).json({ message: 'Terjadi kesalahan server!' });
    }
});

// Ambil profile user
app.get('/api/users/:id', (req, res) => {
    db.query('SELECT id, name, username, email, bio, avatar, role, created_at FROM users WHERE id = ?', [req.params.id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ message: 'User tidak ditemukan' });
        res.json(results[0]);
    });
});

// Serve static files (harus di setelah API routes)
app.use(express.static(__dirname));

// Route root ke home.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'home.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('❌ Server Error:', err.message);
    res.status(500).json({ message: 'Terjadi kesalahan server!' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ message: 'Endpoint tidak ditemukan!' });
});

// Jalankan Server
app.listen(PORT, () => {
    console.log(`🚀 Server backend berjalan di http://localhost:${PORT}`);
});