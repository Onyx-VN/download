const express = require('express');
const cors = require('cors');
const path = require('path');

// Import route
const downloadRouter = require('./routes/index');

const app = express();
const PORT = process.env.PORT || 3000;

// Security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// API routes - endpoint là /download
app.use('/download', downloadRouter);

// Serve HTML interface
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API info
app.get('/api', (req, res) => {
    res.json({
        name: 'J2Download API',
        version: '1.0.0',
        endpoints: {
            download: {
                method: 'GET',
                path: '/download?url=<URL>',
                description: 'Download from social media'
            },
            downloadPost: {
                method: 'POST',
                path: '/download',
                body: { url: '<URL>' },
                description: 'Download from social media'
            }
        },
        supported_platforms: [
            'TikTok', 'YouTube', 'Facebook', 'Instagram', 'Twitter/X',
            'Threads', 'Vimeo', 'Dailymotion', 'Twitch', 'SoundCloud',
            'Bilibili', 'Douyin', 'Xiaohongshu', 'Kuaishou', 'Weibo',
            'Pinterest', 'Snapchat', 'Reddit', 'LinkedIn', 'Rumble',
            'Kwai', 'Likee', 'Lemon8', 'CapCut', 'VK', 'Streamable',
            'Imgur', 'Tumblr', 'Mixcloud', 'Bandcamp', 'Spotify', 'Telegram'
        ]
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        status: 404,
        success: false,
        error: 'Endpoint not found'
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        status: 500,
        success: false,
        error: 'Internal server error'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 J2Download Server running on http://localhost:${PORT}`);
    console.log(`📱 Open http://localhost:${PORT} to use the web interface`);
    console.log(`📡 API endpoint: http://localhost:${PORT}/download?url=<URL>`);
    console.log(`📊 Supported platforms: 30+`);
});
