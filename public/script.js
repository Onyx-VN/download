document.addEventListener('DOMContentLoaded', function() {
    const urlInput = document.getElementById('urlInput');
    const downloadBtn = document.getElementById('downloadBtn');
    const loading = document.getElementById('loading');
    const result = document.getElementById('result');
    const error = document.getElementById('error');
    const errorMessage = document.getElementById('errorMessage');
    const clearBtn = document.getElementById('clearBtn');
    const exampleBtns = document.querySelectorAll('.example-btn');

    // Real-time URL validation
    urlInput.addEventListener('input', function() {
        const url = this.value.trim();
        if (url) {
            try {
                const parsed = new URL(url);
                if (!parsed.protocol.startsWith('http')) {
                    this.style.borderColor = '#ff6b6b';
                } else {
                    this.style.borderColor = '#6C63FF';
                }
            } catch (_) {
                this.style.borderColor = '#ffd93d';
            }
        } else {
            this.style.borderColor = '';
        }
    });

    // Handle download
    async function handleDownload() {
        const url = urlInput.value.trim();
        
        if (!url) {
            showError('Please enter a valid URL');
            return;
        }

        // Validate URL
        try {
            const parsed = new URL(url);
            if (!parsed.protocol.startsWith('http')) {
                showError('URL must start with http:// or https://');
                return;
            }
        } catch (_) {
            showError('Invalid URL format. Please check and try again.');
            return;
        }

        // Show loading
        hideAll();
        loading.classList.remove('hidden');

        // Disable button
        downloadBtn.disabled = true;
        downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

        try {
            const response = await fetch(`/download?url=${encodeURIComponent(url)}`);
            const data = await response.json();

            if (data.success) {
                if (data.warning) {
                    console.warn('Warning:', data.warning);
                }
                displayResult(data);
            } else {
                let errorMsg = data.error || 'Failed to download content';
                if (data.supported && Array.isArray(data.supported)) {
                    errorMsg += '\n\nSupported platforms: ' + data.supported.join(', ');
                }
                showError(errorMsg);
            }
        } catch (err) {
            showError('Network error: ' + err.message);
        } finally {
            // Re-enable button
            downloadBtn.disabled = false;
            downloadBtn.innerHTML = '<i class="fas fa-arrow-right"></i> Download';
            loading.classList.add('hidden');
        }
    }

    // Display result
    function displayResult(data) {
        hideAll();
        result.classList.remove('hidden');

        const platformBadge = document.getElementById('platformBadge');
        const thumbnail = document.getElementById('thumbnail');
        const videoTitle = document.getElementById('videoTitle');
        const videoAuthor = document.getElementById('videoAuthor');
        const videoDuration = document.getElementById('videoDuration');
        const viewsCount = document.getElementById('viewsCount');
        const likesCount = document.getElementById('likesCount');
        const commentsCount = document.getElementById('commentsCount');
        const sharesCount = document.getElementById('sharesCount');

        const d = data.data;

        platformBadge.textContent = d.platform || 'Unknown';
        platformBadge.style.background = getPlatformColor(d.platform);

        if (d.thumbnail) {
            thumbnail.src = d.thumbnail;
            thumbnail.alt = d.title || 'Thumbnail';
            thumbnail.onerror = function() {
                this.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="225" viewBox="0 0 400 225"%3E%3Crect width="400" height="225" fill="%23222244"/%3E%3Ctext x="200" y="117" text-anchor="middle" fill="%23666" font-family="Arial" font-size="20"%3ENo Thumbnail%3C/text%3E%3C/svg%3E';
            };
        } else {
            thumbnail.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="225" viewBox="0 0 400 225"%3E%3Crect width="400" height="225" fill="%23222244"/%3E%3Ctext x="200" y="117" text-anchor="middle" fill="%23666" font-family="Arial" font-size="20"%3ENo Thumbnail%3C/text%3E%3C/svg%3E';
        }

        videoTitle.textContent = d.title || 'Untitled';
        videoAuthor.textContent = d.author ? `👤 ${d.author}` : 'Unknown Author';
        videoDuration.textContent = d.duration ? `⏱️ ${formatDuration(d.duration)}` : '⏱️ Unknown duration';

        // Statistics
        viewsCount.textContent = formatNumber(d.statistics.views);
        likesCount.textContent = formatNumber(d.statistics.likes);
        commentsCount.textContent = formatNumber(d.statistics.comments);
        sharesCount.textContent = formatNumber(d.statistics.shares);

        // Download options
        const downloadOptions = document.getElementById('downloadOptions');
        downloadOptions.innerHTML = '';

        // Best video
        if (d.best_video) {
            const btn = createDownloadButton(
                d.best_video,
                'Best Video',
                'fa-video'
            );
            downloadOptions.appendChild(btn);
        }

        // Best audio
        if (d.best_audio) {
            const btn = createDownloadButton(
                d.best_audio,
                'Best Audio',
                'fa-music'
            );
            downloadOptions.appendChild(btn);
        }

        // All medias
        const allMedias = document.getElementById('allMedias');
        allMedias.innerHTML = '';
        
        if (d.medias && d.medias.length > 0) {
            d.medias.forEach((media, index) => {
                const item = document.createElement('div');
                item.className = 'media-item';
                
                const icon = media.type === 'video' ? 'fa-video' : media.type === 'audio' ? 'fa-music' : 'fa-image';
                const sizeText = media.size_mb ? `${media.size_mb} MB` : 'Unknown size';
                
                item.innerHTML = `
                    <div class="media-item-info">
                        <i class="fas ${icon}"></i>
                        <span class="media-type">${media.type}</span>
                        <span class="media-quality">${media.quality || 'Standard'}</span>
                        <span class="media-size">${sizeText}</span>
                        <span class="media-format">.${media.extension || 'mp4'}</span>
                    </div>
                    <a href="${media.url}" target="_blank" rel="noopener noreferrer" class="btn-download-small">
                        <i class="fas fa-download"></i> Download
                    </a>
                `;
                
                allMedias.appendChild(item);
            });
        }

        // Scroll to result
        result.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function getPlatformColor(platform) {
        const colors = {
            'TikTok': '#000000',
            'YouTube': '#FF0000',
            'Instagram': '#E4405F',
            'Facebook': '#1877F2',
            'Twitter/X': '#000000',
            'Threads': '#000000',
            'Vimeo': '#1AB7EA',
            'SoundCloud': '#FF5500',
            'Spotify': '#1DB954',
            'Reddit': '#FF4500',
            'Pinterest': '#E60023',
            'Twitch': '#9146FF',
            'LinkedIn': '#0A66C2',
            'Telegram': '#26A5E4',
            'Bilibili': '#00A1D6',
            'Douyin': '#000000',
            'VK': '#4C75A3',
            'Rumble': '#85C742'
        };
        return colors[platform] || '#6C63FF';
    }

    function createDownloadButton(media, label, icon) {
        const container = document.createElement('div');
        container.className = 'download-option';
        
        const qualityText = media.quality ? ` (${media.quality})` : '';
        const sizeText = media.size_mb ? ` - ${media.size_mb} MB` : '';
        
        container.innerHTML = `
            <div class="download-option-info">
                <i class="fas ${icon}"></i>
                <span><strong>${label}</strong>${qualityText}</span>
                <span class="file-info">${media.extension || 'mp4'}${sizeText}</span>
            </div>
            <a href="${media.url}" target="_blank" rel="noopener noreferrer" class="btn-download">
                <i class="fas fa-download"></i> Download
            </a>
        `;
        
        return container;
    }

    // Show error
    function showError(message) {
        hideAll();
        error.classList.remove('hidden');
        errorMessage.textContent = message;
    }

    // Hide all result sections
    function hideAll() {
        result.classList.add('hidden');
        error.classList.add('hidden');
        loading.classList.add('hidden');
    }

    // Clear result
    function clearResult() {
        hideAll();
        urlInput.value = '';
        urlInput.focus();
        urlInput.style.borderColor = '';
    }

    // Format duration
    function formatDuration(seconds) {
        if (!seconds) return '0s';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        if (mins > 0) {
            return `${mins}m ${secs}s`;
        }
        return `${secs}s`;
    }

    // Format number (e.g., 1000 -> 1K)
    function formatNumber(num) {
        if (!num) return '0';
        if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
        if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
        if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
        return num.toString();
    }

    // Event listeners
    downloadBtn.addEventListener('click', handleDownload);
    
    urlInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleDownload();
        }
    });

    clearBtn.addEventListener('click', clearResult);

    // Example buttons
    exampleBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            urlInput.value = this.dataset.url;
            urlInput.style.borderColor = '#6C63FF';
            handleDownload();
        });
    });

    // Auto-focus
    urlInput.focus();
});
