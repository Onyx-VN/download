'use strict';

/**
 * J2Download — Universal Social Media Downloader
 * Port từ J2DownloadClient.py, không cần Selenium
 *
 * GET  /download?url=https://www.tiktok.com/...
 * POST /download  body: { "url": "..." }
 */

const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');

const BASE_URL = 'https://j2download.com';
const UA       = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36';

const COMMON_HDRS = {
  'sec-ch-ua':          '"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
  'sec-ch-ua-mobile':   '?0',
  'sec-ch-ua-platform': '"Windows"',
};

// ── Token cache (reuse within ~25 min validity) ───────────────────────────────
const tokenCache = {
  token:   null,
  exp:     0,
  cookies: '',
};

// ── URL Validation & Security ──────────────────────────────────────────────────
const URL_PATTERNS = {
  // TikTok
  tiktok: /^(https?:\/\/)?(www\.)?(tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com)\/.+/i,
  tiktok_embed: /^(https?:\/\/)?(www\.)?tiktok\.com\/embed\/.+/i,
  tiktok_share: /^(https?:\/\/)?(www\.)?(tiktok\.com|vm\.tiktok\.com)\/share\/.+/i,
  
  // YouTube
  youtube: /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)\/.+/i,
  youtube_embed: /^(https?:\/\/)?(www\.)?youtube\.com\/embed\/.+/i,
  youtube_short: /^(https?:\/\/)?(www\.)?youtube\.com\/shorts\/.+/i,
  
  // Instagram
  instagram: /^(https?:\/\/)?(www\.)?instagram\.com\/(p|reel|tv|stories)\/.+/i,
  
  // Facebook
  facebook: /^(https?:\/\/)?(www\.)?(facebook\.com|fb\.watch|fb\.com)\/.+/i,
  facebook_video: /^(https?:\/\/)?(www\.)?facebook\.com\/.*\/videos\/.+/i,
  facebook_watch: /^(https?:\/\/)?(www\.)?fb\.watch\/.+/i,
  
  // Twitter/X
  twitter: /^(https?:\/\/)?(www\.)?(twitter\.com|x\.com)\/.+/i,
  
  // Threads
  threads: /^(https?:\/\/)?(www\.)?threads\.net\/.+/i,
  
  // Vimeo
  vimeo: /^(https?:\/\/)?(www\.)?vimeo\.com\/.+/i,
  
  // Dailymotion
  dailymotion: /^(https?:\/\/)?(www\.)?(dailymotion\.com|dai\.ly)\/.+/i,
  
  // Twitch
  twitch: /^(https?:\/\/)?(www\.)?twitch\.tv\/(videos|clips|.+\/clip)\/.+/i,
  twitch_clip: /^(https?:\/\/)?(www\.)?clips\.twitch\.tv\/.+/i,
  
  // SoundCloud
  soundcloud: /^(https?:\/\/)?(www\.)?soundcloud\.com\/.+/i,
  
  // Bilibili
  bilibili: /^(https?:\/\/)?(www\.)?bilibili\.com\/(video|bangumi|list)\/.+/i,
  bilibili_short: /^(https?:\/\/)?b23\.tv\/.+/i,
  
  // Douyin
  douyin: /^(https?:\/\/)?(www\.)?douyin\.com\/(video|note)\/.+/i,
  douyin_short: /^(https?:\/\/)?v\.douyin\.com\/.+/i,
  
  // Xiaohongshu / RedNote
  xiaohongshu: /^(https?:\/\/)?(www\.)?xiaohongshu\.com\/(discovery|explore)\/.+/i,
  xiaohongshu_short: /^(https?:\/\/)?xhslink\.com\/.+/i,
  
  // Kuaishou
  kuaishou: /^(https?:\/\/)?(www\.)?kuaishou\.com\/(photo|short-video|live)\/.+/i,
  kuaishou_short: /^(https?:\/\/)?v\.kuaishou\.com\/.+/i,
  
  // Weibo
  weibo: /^(https?:\/\/)?(www\.)?(weibo\.com|weibo\.cn)\/.+/i,
  
  // Pinterest
  pinterest: /^(https?:\/\/)?(www\.)?pinterest\.com\/(pin|video)\/.+/i,
  pinterest_short: /^(https?:\/\/)?pin\.it\/.+/i,
  
  // Snapchat
  snapchat: /^(https?:\/\/)?(www\.)?(snapchat\.com|story\.snapchat\.com)\/.+/i,
  
  // Reddit
  reddit: /^(https?:\/\/)?(www\.)?(reddit\.com|redd\.it|v\.redd\.it)\/.+/i,
  
  // LinkedIn
  linkedin: /^(https?:\/\/)?(www\.)?linkedin\.com\/(feed|video|posts)\/.+/i,
  
  // Rumble
  rumble: /^(https?:\/\/)?(www\.)?rumble\.com\/(v|embed)\/.+/i,
  
  // Kwai
  kwai: /^(https?:\/\/)?(www\.)?(kwai\.com|kwai\.net)\/.+/i,
  
  // Likee
  likee: /^(https?:\/\/)?(www\.)?(likee\.video|like\.video)\/.+/i,
  
  // Lemon8
  lemon8: /^(https?:\/\/)?(www\.)?lemon8-app\.com\/.+/i,
  
  // CapCut
  capcut: /^(https?:\/\/)?(www\.)?capcut\.com\/.+/i,
  
  // VK
  vk: /^(https?:\/\/)?(www\.)?(vk\.com|vkvideo\.ru)\/.+/i,
  
  // Streamable
  streamable: /^(https?:\/\/)?(www\.)?streamable\.com\/.+/i,
  
  // Imgur
  imgur: /^(https?:\/\/)?(www\.)?imgur\.com\/(gallery|a)\/.+/i,
  
  // Tumblr
  tumblr: /^(https?:\/\/)?(www\.)?tumblr\.com\/.+/i,
  
  // Mixcloud
  mixcloud: /^(https?:\/\/)?(www\.)?mixcloud\.com\/.+/i,
  
  // Bandcamp
  bandcamp: /^(https?:\/\/)?(www\.)?bandcamp\.com\/.+/i,
  
  // Spotify
  spotify: /^(https?:\/\/)?(open\.spotify\.com|spotify\.com)\/(track|album|playlist|episode)\/.+/i,
  
  // Telegram
  telegram: /^(https?:\/\/)?t\.me\/.+/i,
};

// ── Platform detection with regex ──────────────────────────────────────────────
const PLATFORM_MAP = {
  // TikTok
  'tiktok.com': 'TikTok', 'vm.tiktok.com': 'TikTok', 'vt.tiktok.com': 'TikTok',
  // YouTube
  'youtube.com': 'YouTube', 'youtu.be': 'YouTube', 'youtube-nocookie.com': 'YouTube',
  // Facebook
  'facebook.com': 'Facebook', 'fb.watch': 'Facebook', 'fb.com': 'Facebook',
  // Instagram
  'instagram.com': 'Instagram',
  // Twitter / X
  'x.com': 'Twitter/X', 'twitter.com': 'Twitter/X',
  // Threads
  'threads.net': 'Threads',
  // Vimeo
  'vimeo.com': 'Vimeo',
  // Dailymotion
  'dailymotion.com': 'Dailymotion', 'dai.ly': 'Dailymotion',
  // Twitch
  'twitch.tv': 'Twitch', 'clips.twitch.tv': 'Twitch',
  // SoundCloud
  'soundcloud.com': 'SoundCloud',
  // Bilibili
  'bilibili.com': 'Bilibili', 'b23.tv': 'Bilibili',
  // Douyin
  'douyin.com': 'Douyin', 'v.douyin.com': 'Douyin',
  // Xiaohongshu / RedNote
  'xiaohongshu.com': 'Xiaohongshu', 'xhslink.com': 'Xiaohongshu',
  // Kuaishou
  'kuaishou.com': 'Kuaishou', 'v.kuaishou.com': 'Kuaishou',
  // Weibo
  'weibo.com': 'Weibo', 'weibo.cn': 'Weibo',
  // Pinterest
  'pinterest.com': 'Pinterest', 'pin.it': 'Pinterest',
  // Snapchat
  'snapchat.com': 'Snapchat', 'story.snapchat.com': 'Snapchat',
  // Reddit
  'reddit.com': 'Reddit', 'redd.it': 'Reddit', 'v.redd.it': 'Reddit',
  // LinkedIn
  'linkedin.com': 'LinkedIn',
  // Rumble
  'rumble.com': 'Rumble',
  // Kwai
  'kwai.com': 'Kwai', 'kwai.net': 'Kwai',
  // Likee
  'likee.video': 'Likee', 'like.video': 'Likee',
  // Lemon8
  'lemon8-app.com': 'Lemon8',
  // CapCut
  'capcut.com': 'CapCut',
  // VK
  'vk.com': 'VK', 'vkvideo.ru': 'VK',
  // Streamable
  'streamable.com': 'Streamable',
  // Imgur
  'imgur.com': 'Imgur',
  // Tumblr
  'tumblr.com': 'Tumblr',
  // Mixcloud
  'mixcloud.com': 'Mixcloud',
  // Bandcamp
  'bandcamp.com': 'Bandcamp',
  // Spotify
  'spotify.com': 'Spotify', 'open.spotify.com': 'Spotify',
  // Telegram
  't.me': 'Telegram',
};

// ── Extract ID from URL using regex ────────────────────────────────────────────
function extractVideoId(url, platform) {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    
    switch(platform) {
      case 'TikTok': {
        const match = path.match(/\/video\/(\d+)/);
        return match ? match[1] : null;
      }
      case 'YouTube': {
        const match = url.match(/[?&]v=([^&]+)/);
        if (match) return match[1];
        const shortMatch = path.match(/^\/([a-zA-Z0-9_-]{11})/);
        if (shortMatch) return shortMatch[1];
        const shortMatch2 = path.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
        if (shortMatch2) return shortMatch2[1];
        const embedMatch = path.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
        if (embedMatch) return embedMatch[1];
        return null;
      }
      case 'Instagram': {
        const match = path.match(/\/(p|reel|tv)\/([^\/]+)/);
        return match ? match[2] : null;
      }
      case 'Facebook': {
        const match = path.match(/\/videos\/(\d+)/) || path.match(/\/video\.php\?id=(\d+)/);
        return match ? match[1] : null;
      }
      case 'Twitter/X': {
        const match = path.match(/\/status\/(\d+)/);
        return match ? match[1] : null;
      }
      case 'Vimeo': {
        const match = path.match(/^\/(\d+)/);
        return match ? match[1] : null;
      }
      case 'SoundCloud': {
        const match = path.match(/^\/([^\/]+\/[^\/]+)/);
        return match ? match[1] : null;
      }
      case 'Reddit': {
        const match = url.match(/\/comments\/([a-zA-Z0-9]+)/);
        return match ? match[1] : null;
      }
      case 'Bilibili': {
        const match = path.match(/\/video\/(BV[a-zA-Z0-9]+)/);
        if (match) return match[1];
        const avMatch = path.match(/\/video\/(av\d+)/);
        return avMatch ? avMatch[1] : null;
      }
      case 'Douyin': {
        const match = path.match(/\/video\/(\d+)/);
        return match ? match[1] : null;
      }
      case 'Pinterest': {
        const match = path.match(/\/pin\/(\d+)/);
        return match ? match[1] : null;
      }
      case 'Spotify': {
        const match = path.match(/\/(track|album|playlist|episode)\/([a-zA-Z0-9]+)/);
        return match ? match[2] : null;
      }
      default:
        return null;
    }
  } catch (_) {
    return null;
  }
}

// ── Security: Sanitize URL ─────────────────────────────────────────────────────
function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') return null;
  
  let clean = url.trim();
  
  if (clean.includes('<') || clean.includes('>') || clean.includes('javascript:')) {
    return null;
  }
  
  if (!/^https?:\/\//i.test(clean)) {
    clean = 'https://' + clean;
  }
  
  if (!/^https?:\/\/[a-zA-Z0-9][a-zA-Z0-9\-\.]+[a-zA-Z0-9]([\/\?#][a-zA-Z0-9\-\._~!$&'()*+,;=:@\/?%]*)?$/i.test(clean)) {
    return null;
  }
  
  try {
    const urlObj = new URL(clean);
    const hostname = urlObj.hostname.toLowerCase();
    if (hostname === 'localhost' || 
        hostname === '127.0.0.1' ||
        hostname === '0.0.0.0' ||
        hostname === '::1' ||
        /^192\.168\./.test(hostname) ||
        /^10\./.test(hostname) ||
        /^172\.(1[6-9]|2[0-9]|3[01])\./.test(hostname) ||
        /^169\.254\./.test(hostname)) {
      return null;
    }
    return urlObj.toString();
  } catch (_) {
    return null;
  }
}

// ── Validate URL against supported patterns ──────────────────────────────────
function validateUrl(url) {
  const sanitized = sanitizeUrl(url);
  if (!sanitized) return { valid: false, error: 'Invalid URL format' };
  
  let matchedPlatform = null;
  let matchedPattern = null;
  
  for (const [platform, pattern] of Object.entries(URL_PATTERNS)) {
    if (pattern.test(sanitized)) {
      matchedPlatform = platform;
      matchedPattern = pattern;
      break;
    }
  }
  
  if (!matchedPlatform) {
    try {
      const hostname = new URL(sanitized).hostname.replace(/^www\./, '');
      for (const [domain, platform] of Object.entries(PLATFORM_MAP)) {
        if (hostname === domain || hostname.endsWith('.' + domain)) {
          return { 
            valid: true, 
            platform: platform,
            url: sanitized,
            warning: 'URL format may not be fully supported'
          };
        }
      }
    } catch (_) {}
    
    return { 
      valid: false, 
      error: 'URL is not from a supported platform',
      supported: Object.values(PLATFORM_MAP).filter((v, i, a) => a.indexOf(v) === i)
    };
  }
  
  let platformName = 'Other';
  try {
    const hostname = new URL(sanitized).hostname.replace(/^www\./, '');
    for (const [domain, name] of Object.entries(PLATFORM_MAP)) {
      if (hostname === domain || hostname.endsWith('.' + domain)) {
        platformName = name;
        break;
      }
    }
  } catch (_) {}
  
  const id = extractVideoId(sanitized, platformName);
  
  return {
    valid: true,
    platform: platformName,
    platform_key: matchedPlatform,
    url: sanitized,
    id: id
  };
}

// ── Step 1: Fetch bootstrap data + session cookie ─────────────────────────────
async function fetchBootstrap() {
  const res = await fetch(`${BASE_URL}/vi`, {
    headers: {
      'user-agent':      UA,
      'accept':          'text/html',
      'accept-language': 'vi,en-US;q=0.9,en;q=0.8',
      ...COMMON_HDRS,
      'sec-fetch-site':  'none',
      'sec-fetch-mode':  'navigate',
      'sec-fetch-dest':  'document',
    },
    redirect: 'follow',
    signal:   AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`j2download page ${res.status}`);

  const cookies = (res.headers.getSetCookie?.() || []).map(c => c.split(';')[0]).join('; ');
  const html    = await res.text();
  const bootStr = html.match(/window\.__BOOTSTRAP__\s*=\s*(\{[^}]+\})/)?.[1];
  if (!bootStr) throw new Error('Không tìm thấy __BOOTSTRAP__ trong trang j2download');

  const boot = JSON.parse(bootStr);
  if (!boot.nonce || !boot.powChallenge) throw new Error('Bootstrap data không hợp lệ');
  return { ...boot, cookies };
}

// ── Step 2: SHA-256 POW ───────────────────────────────────────────────────────
function computePOW(challenge, nonce, difficulty, maxIter = 5_000_000) {
  const prefix = `pow:${challenge}:`;
  const suffix = `:${nonce}:${challenge.length}`;
  const zeroes = '0'.repeat(difficulty);

  for (let n = 0; n < maxIter; n++) {
    const hash = crypto.createHash('sha256').update(prefix + n + suffix).digest('hex');
    if (hash.startsWith(zeroes)) return String(n);
  }
  throw new Error(`POW không tìm thấy sau ${maxIter} lần thử (difficulty=${difficulty})`);
}

// ── Step 3: Lấy access token ──────────────────────────────────────────────────
async function getToken(nonce, powSolution, cookies) {
  const res = await fetch(`${BASE_URL}/api/auth/issue`, {
    method: 'POST',
    headers: {
      'X-Page-Nonce':    nonce,
      'X-Pow-Solution':  powSolution,
      'user-agent':      UA,
      'accept':          'application/json, text/plain, */*',
      ...COMMON_HDRS,
      'origin':          BASE_URL,
      'sec-fetch-site':  'same-origin',
      'sec-fetch-mode':  'cors',
      'sec-fetch-dest':  'empty',
      'referer':         `${BASE_URL}/vi`,
      'cookie':          cookies,
    },
    signal: AbortSignal.timeout(15000),
  });

  const data = await res.json();
  if (data.error)        throw new Error(`j2download auth: ${data.error}`);
  if (!data.accessToken) throw new Error('Không nhận được access token từ j2download');
  return data.accessToken;
}

// ── Step 4: Gọi autolink để lấy download links ───────────────────────────────
async function callAutolink(url, token, cookies) {
  const res = await fetch(`${BASE_URL}/api/autolink`, {
    method: 'POST',
    headers: {
      'authorization':  `Bearer ${token}`,
      'content-type':   'application/json',
      'accept':         'application/json, text/plain, */*',
      'user-agent':     UA,
      ...COMMON_HDRS,
      'origin':         BASE_URL,
      'sec-fetch-site': 'same-origin',
      'sec-fetch-mode': 'cors',
      'sec-fetch-dest': 'empty',
      'referer':        `${BASE_URL}/vi`,
      'cookie':         cookies,
    },
    body:   JSON.stringify({ data: { url } }),
    signal: AbortSignal.timeout(30000),
  });

  const data = await res.json();

  const SESSION_ERRORS = ['session_required', 'bootstrap_expired', 'page_nonce_invalid', 'pow_context_invalid', 'session_expired', 'access_token_expired', 'token_expired', 'invalid_token', 'unauthorized'];
  if (data.error === true || typeof data.error === 'string') {
    const errCode = typeof data.error === 'string' ? data.error : (data.message || 'unknown_error');
    if (SESSION_ERRORS.includes(errCode)) {
      const err = new Error(errCode);
      err.retryable = true;
      throw err;
    }
    throw new Error(data.message || errCode);
  }

  return data;
}

// ── Full flow with auto-retry on session errors ───────────────────────────────
async function downloadLinks(url, maxRetries = 2) {
  let lastErr;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (attempt === 0 && tokenCache.token && Date.now() < tokenCache.exp) {
        try {
          return await callAutolink(url, tokenCache.token, tokenCache.cookies);
        } catch (e) {
          if (!e.retryable) throw e;
          tokenCache.token = null;
        }
      }

      const { nonce, powChallenge, powDifficulty, cookies } = await fetchBootstrap();
      const solution = computePOW(powChallenge, nonce, powDifficulty);
      const token    = await getToken(nonce, solution, cookies);

      tokenCache.token   = token;
      tokenCache.exp     = Date.now() + 25 * 60 * 1000;
      tokenCache.cookies = cookies;

      return await callAutolink(url, token, cookies);
    } catch (e) {
      lastErr = e;
      if (!e.retryable) throw e;
      await new Promise(r => setTimeout(r, 300));
    }
  }

  throw lastErr;
}

// ── Format response ───────────────────────────────────────────────────────────
function formatResult(raw, platform, id) {
  const stats = raw.statistics || {};

  const QUALITY_RANK = {
    hd_no_watermark: 10, no_watermark: 9, hd: 8,
    watermark: 7, high: 6, medium: 5, low: 4, audio: 3,
  };

  const medias = (raw.medias || []).map(m => ({
    type:      m.type,
    quality:   m.quality,
    extension: m.extension || (m.type === 'video' ? 'mp4' : m.type === 'audio' ? 'mp3' : 'jpg'),
    size_mb:   m.data_size > 0 ? +(m.data_size / 1024 / 1024).toFixed(2) : null,
    url:       m.url,
  }));

  const bestVideo = medias
    .filter(m => m.type === 'video')
    .sort((a, b) => (QUALITY_RANK[b.quality] || 0) - (QUALITY_RANK[a.quality] || 0))[0] || null;

  const bestAudio = medias.find(m => m.type === 'audio') || null;

  return {
    platform,
    id:        id || raw.id || null,
    title:     raw.title !== 'Unknown' && raw.title ? raw.title : null,
    author:    raw.author !== 'Unknown' ? raw.author : null,
    duration:  raw.duration  || null,
    thumbnail: raw.thumbnail || null,
    source:    raw.source    || null,
    statistics: {
      views:    stats.play_count    || stats.view_count   || null,
      likes:    stats.digg_count    || stats.like_count   || null,
      comments: stats.comment_count || null,
      shares:   stats.share_count   || null,
    },
    best_video: bestVideo,
    best_audio: bestAudio,
    medias,
    source_url: raw.url,
  };
}

// ── GET /download?url=... ──────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const rawUrl = (req.query.url || req.query.link || req.query.u || '').trim();
  
  if (!rawUrl) {
    return res.status(400).json({
      status: 400,
      success: false,
      error: 'Missing ?url= parameter',
      example: '/download?url=https://www.tiktok.com/@user/video/123',
      supported: Object.values(PLATFORM_MAP).filter((v, i, a) => a.indexOf(v) === i)
    });
  }

  const validation = validateUrl(rawUrl);
  
  if (!validation.valid) {
    return res.status(400).json({
      status: 400,
      success: false,
      error: validation.error,
      supported: validation.supported || Object.values(PLATFORM_MAP).filter((v, i, a) => a.indexOf(v) === i),
      warning: validation.warning || null
    });
  }

  try {
    const raw = await downloadLinks(validation.url);
    const result = formatResult(raw, validation.platform, validation.id);
    
    const response = {
      status: 200,
      success: true,
      platform: validation.platform,
      data: result
    };
    
    if (validation.warning) {
      response.warning = validation.warning;
    }
    
    res.json(response);
  } catch (e) {
    const code = e.status || 500;
    res.status(code).json({
      status: code,
      success: false,
      error: e.message,
      platform: validation.platform
    });
  }
});

// ── POST /download ─────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const rawUrl = (req.body?.url || req.body?.link || '').trim();
  
  if (!rawUrl) {
    return res.status(400).json({
      status: 400,
      success: false,
      error: 'Missing "url" in JSON body',
      example: { url: 'https://www.tiktok.com/@user/video/123' }
    });
  }

  const validation = validateUrl(rawUrl);
  
  if (!validation.valid) {
    return res.status(400).json({
      status: 400,
      success: false,
      error: validation.error,
      supported: validation.supported || Object.values(PLATFORM_MAP).filter((v, i, a) => a.indexOf(v) === i)
    });
  }

  try {
    const raw = await downloadLinks(validation.url);
    const result = formatResult(raw, validation.platform, validation.id);
    
    const response = {
      status: 200,
      success: true,
      platform: validation.platform,
      data: result
    };
    
    if (validation.warning) {
      response.warning = validation.warning;
    }
    
    res.json(response);
  } catch (e) {
    const code = e.status || 500;
    res.status(code).json({
      status: code,
      success: false,
      error: e.message,
      platform: validation.platform
    });
  }
});

module.exports = router;
