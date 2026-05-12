// pwa.js — registers the PWA service worker (NO auto-refresh loop)
// This file is included in every HTML page just before </body>

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Register service worker normally (no timestamp to prevent loops)
        navigator.serviceWorker.register('/sw.js', { scope: '/' })
            .then((reg) => {
                console.log('[PWA] Service worker registered ✅', reg.scope);
                
                // Check for updates but DON'T auto-refresh
                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing;
                    console.log('[PWA] Update available in background');
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            console.log('[PWA] New version ready. Refresh manually to update.');
                            // Show a subtle notification instead of auto-refreshing
                            const toast = document.createElement('div');
                            toast.textContent = '🔄 New version available. Refresh the page to update.';
                            toast.style.cssText = 'position:fixed;bottom:20px;left:20px;right:20px;background:#d9914a;color:white;padding:12px;border-radius:40px;text-align:center;z-index:9999;font-size:14px;cursor:pointer;';
                            toast.onclick = () => window.location.reload(true);
                            document.body.appendChild(toast);
                            setTimeout(() => toast.remove(), 8000);
                        }
                    });
                });
            })
            .catch((err) => {
                console.warn('[PWA] Service worker registration failed:', err);
            });
    });
} else {
    console.warn('[PWA] Service workers not supported in this browser');
}

// Helper function to manually clear everything
window.forceRefresh = function() {
    localStorage.clear();
    sessionStorage.clear();
    if ('caches' in window) {
        caches.keys().then(keys => keys.forEach(key => caches.delete(key)));
    }
    navigator.serviceWorker.getRegistrations().then(regs => {
        regs.forEach(reg => reg.unregister());
    });
    setTimeout(() => window.location.reload(true), 500);
};
console.log('💡 Type "forceRefresh()" in console to clear all caches and reload');