// sw.js — Service Worker for Devotional Tracker PWA (iOS + Android)
// IMPORTANT: Increment this version number ONLY when you make actual changes
const CACHE_VERSION = 'v9';
const CACHE_NAME = `devotional-tracker-${CACHE_VERSION}`;

const FILES_TO_CACHE = [
    '/',
    '/index.html',
    '/offline.html',
    '/tracker.html',
    '/stats.html',
    '/login.html',
    '/signup.html',
    '/about.html',
    '/argala-stotram.html',
    '/hanuman-chalisa.html',
    '/gita-quotes.html',
    '/404.html',
    '/style.css',
    '/tracker.js',
    '/auth.js',
    '/firebase-config.js',
    '/pwa.js',
    '/manifest.json',
    '/icons/icon-72.png',
    '/icons/icon-96.png',
    '/icons/icon-128.png',
    '/icons/icon-144.png',
    '/icons/icon-152.png',
    '/icons/icon-192.png',
    '/icons/icon-384.png',
    '/icons/icon-512.png'
];

// ── Install ────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
    console.log('[SW] Installing version:', CACHE_VERSION);
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching files including offline.html and all icons');
                return cache.addAll(FILES_TO_CACHE);
            })
            .then(() => self.skipWaiting())
    );
});

// ── Activate: remove old caches (NO auto-refresh!) ─────────────────────────
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating version:', CACHE_VERSION);
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log('[SW] Deleting old cache:', key);
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => {
            console.log('[SW] Taking control of clients');
            return self.clients.claim();
        })
    );
    // ✅ NO auto-refresh - safe!
});

// ── Fetch: with offline fallback for navigation ───────────────────────────
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const url = event.request.url;

    // Let Firebase, Google APIs, fonts, CDN go straight to network
    const networkOnly = [
        'firestore.googleapis.com',
        'firebase.googleapis.com',
        'googleapis.com',
        'gstatic.com',
        'firebaseapp.com',
        'fonts.googleapis.com',
        'fonts.gstatic.com',
        'cdn.jsdelivr.net',
        'identitytoolkit'
    ];
    if (networkOnly.some(domain => url.includes(domain))) return;

    const request = event.request;
    
    // 🔥 CRITICAL: For navigation requests (page loads)
    // Show offline.html when user has no internet AND nothing is cached
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Cache the fresh page for offline use
                    if (response && response.status === 200) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(request, clone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // Offline: try to serve offline.html from cache
                    return caches.match('/offline.html')
                        .then(cached => {
                            if (cached) return cached;
                            // Ultimate fallback - try index.html
                            return caches.match('/index.html');
                        });
                })
        );
        return;
    }

    // For static assets (CSS, JS, images) - use CACHE FIRST
    event.respondWith(
        caches.match(request).then((cached) => {
            if (cached) return cached;
            return fetch(request).then((response) => {
                if (response && response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(request, clone);
                    });
                }
                return response;
            });
        })
    );
});

// ── Message handler for manual updates ─────────────────────────────
self.addEventListener('message', (event) => {
    if (event.data === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});