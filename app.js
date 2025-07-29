const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { qrisDinamis } = require('./dinamis');

const app = express();
const port = process.env.PORT || 3002;

app.use(express.json());
app.use(cors());
app.set('trust proxy', true);

// Folder penyimpanan QR
const QR_DIR = '/tmp';
const FILE_EXPIRATION_MS = 30 * 60 * 1000; // 30 menit

app.use(express.static(path.join(__dirname, 'public')));

// Endpoint akses QR file
app.get('/qris/:filename', (req, res) => {
    const filePath = path.join(QR_DIR, req.params.filename);
    res.sendFile(filePath, err => {
        if (err) res.status(404).send('File not found');
    });
});

// Endpoint generate QRIS
app.post('/api/generate', async (req, res) => {
    const { amount } = req.body;
    if (!amount || isNaN(amount)) return res.status(400).json({ error: 'Invalid amount' });

    try {
        const filename = `QR${Date.now()}.jpg`;
        const filepath = path.join(QR_DIR, filename);

        await qrisDinamis(amount, filepath);

        return res.json({
            qris: `${req.protocol}://${req.get('host')}/qris/${filename}`
        });
    } catch (err) {
        console.error('Failed to generate QRIS:', err);
        res.status(500).json({ error: 'Failed to generate QRIS' });
    }
});

// Fungsi hapus file yang lebih dari 30 menit
function cleanOldFiles() {
    fs.readdir(QR_DIR, (err, files) => {
        if (err) return console.error('Gagal membaca direktori:', err);

        const now = Date.now();
        files.forEach(file => {
            if (!file.endsWith('.jpg')) return;

            const filePath = path.join(QR_DIR, file);
            fs.stat(filePath, (err, stats) => {
                if (err) return;
                const age = now - stats.mtimeMs;
                if (age > FILE_EXPIRATION_MS) {
                    fs.unlink(filePath, err => {
                        if (!err) {
                            console.log(`🧹 Hapus file lama: ${file}`);
                        }
                    });
                }
            });
        });
    });
}

// Jalankan pembersihan setiap 30 menit
setInterval(cleanOldFiles, 30 * 60 * 1000);

// Catch-all 404
app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
});

if (require.main === module) {
    app.listen(port, () => {
        console.log(`QRIS Generator aktif di http://localhost:${port}`);
    });
}

module.exports = app;
