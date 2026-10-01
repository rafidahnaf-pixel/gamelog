const mysql = require('mysql2');
const bcrypt = require('bcrypt');

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gamelog_db'
});

db.connect(async (err) => {
    if (err) {
        console.error('❌ Koneksi database gagal:', err.message);
        process.exit(1);
    }

    console.log('✅ Terhubung ke database');
    console.log('🔄 Mulai migrasi password...\n');

    // Ambil semua user dengan password plain text
    db.query('SELECT id, username, password FROM users', async (err, users) => {
        if (err) {
            console.error('❌ Gagal mengambil users:', err.message);
            process.exit(1);
        }

        if (users.length === 0) {
            console.log('✅ Tidak ada user untuk dimigrasi');
            process.exit(0);
        }

        let migrated = 0;
        let skipped = 0;

        for (const user of users) {
            // Cek sudah hashed atau belum (bcrypt hash mulai dengan $2a$ atau $2b$)
            if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
                console.log(`⏭️  @${user.username} - sudah hashed, skip`);
                skipped++;
                continue;
            }

            try {
                const hashedPassword = await bcrypt.hash(user.password, 10);
                db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, user.id], (err) => {
                    if (err) {
                        console.error(`❌ Gagal hash password @${user.username}:`, err.message);
                    } else {
                        console.log(`✅ @${user.username} - password di-hash`);
                        migrated++;
                    }
                });
            } catch (hashErr) {
                console.error(`❌ Error hash @${user.username}:`, hashErr.message);
            }
        }

        // Tunggu semua query selesai
        setTimeout(() => {
            console.log(`\n📊 Migrasi selesai:`);
            console.log(`   - ${migrated} password di-hash`);
            console.log(`   - ${skipped} sudah hashed (skip)`);
            console.log(`   - Total ${users.length} user`);
            process.exit(0);
        }, 2000);
    });
});