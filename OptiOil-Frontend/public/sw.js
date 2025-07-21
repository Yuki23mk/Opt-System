// /public/sw.js - Service Worker for OptiOil PWA

const CACHE_NAME = 'optioil-data-monitor-v1';
const OFFLINE_URL = '/offline';

// キャッシュするリソース
const urlsToCache = [
  '/',
  '/data-monitor',
  '/offline',
  '/manifest.json',
  // 静的リソースは動的に追加
];

// インストール時のキャッシュ設定
self.addEventListener('install', (event) => {
  console.log('[SW] Install event');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('[SW] Failed to open cache:', error);
      })
  );
  self.skipWaiting();
});

// 古いキャッシュの削除
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate event');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// フェッチイベント（オフライン対応の中核）
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API リクエストの場合
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // ページリクエストの場合
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  // その他のリソース
  event.respondWith(handleResourceRequest(request));
});

// API リクエストの処理
async function handleApiRequest(request) {
  const url = new URL(request.url);
  
  try {
    console.log('[SW] API request:', request.method, url.pathname);
    
    // オンライン時：通常のAPIリクエスト
    const response = await fetch(request);
    
    // GET リクエストの場合、成功したレスポンスをキャッシュ
    if (request.method === 'GET' && response.ok) {
      const responseClone = response.clone();
      caches.open(CACHE_NAME).then((cache) => {
        cache.put(request, responseClone);
      });
      
      // 測定データなどの重要なデータはIndexedDBにも保存
      if (url.pathname.includes('/measurement') || url.pathname.includes('/project')) {
        try {
          const data = await response.clone().json();
          await saveToIndexedDB(request.url, data);
        } catch (error) {
          console.error('[SW] Failed to save to IndexedDB:', error);
        }
      }
    }
    
    // POST/PUT/PATCH の場合、成功時にオフラインキューをクリア
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) && response.ok) {
      await clearOfflineQueue();
    }
    
    return response;
  } catch (error) {
    console.log('[SW] API request failed, trying offline fallback:', error);
    
    // GET リクエストの場合、キャッシュまたはIndexedDBから取得
    if (request.method === 'GET') {
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        console.log('[SW] Returning cached API response');
        return cachedResponse;
      }
      
      const indexedDBData = await getFromIndexedDB(request.url);
      if (indexedDBData) {
        console.log('[SW] Returning IndexedDB data');
        return new Response(JSON.stringify(indexedDBData), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // POST/PUT/PATCH の場合、オフラインキューに追加
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      await addToOfflineQueue(request);
      return new Response(JSON.stringify({ 
        success: true, 
        offline: true,
        message: 'オフラインで保存されました。オンライン復帰時に同期されます。'
      }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // オフライン用のエラーレスポンス
    return new Response(JSON.stringify({
      error: 'オフラインのため利用できません',
      offline: true
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ページナビゲーションの処理
async function handleNavigationRequest(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch (error) {
    console.log('[SW] Navigation request failed, trying cache');
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    return cachedResponse || caches.match(OFFLINE_URL) || new Response('オフラインです', {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
}

// 静的リソースの処理
async function handleResourceRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('[SW] Resource request failed:', error);
    return new Response('リソースを読み込めませんでした', { status: 404 });
  }
}

// IndexedDB 操作関数
async function saveToIndexedDB(key, data) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('OptOilOfflineDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['data'], 'readwrite');
      const store = transaction.objectStore('data');
      store.put({ key, data, timestamp: Date.now() });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    };
    
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('data')) {
        db.createObjectStore('data', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('queue')) {
        db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

async function getFromIndexedDB(key) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('OptOilOfflineDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['data'], 'readonly');
      const store = transaction.objectStore('data');
      const getRequest = store.get(key);
      
      getRequest.onsuccess = () => {
        const result = getRequest.result;
        resolve(result ? result.data : null);
      };
      getRequest.onerror = () => resolve(null);
    };
  });
}

// オフラインキューの管理
async function addToOfflineQueue(request) {
  try {
    const requestData = {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body: request.method !== 'GET' ? await request.text() : null,
      timestamp: Date.now()
    };
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('OptOilOfflineDB', 1);
      
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['queue'], 'readwrite');
        const store = transaction.objectStore('queue');
        store.add(requestData);
        transaction.oncomplete = () => {
          console.log('[SW] Added to offline queue:', requestData.url);
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[SW] Failed to add to offline queue:', error);
  }
}

async function clearOfflineQueue() {
  return new Promise((resolve) => {
    const request = indexedDB.open('OptOilOfflineDB', 1);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['queue'], 'readwrite');
      const store = transaction.objectStore('queue');
      store.clear();
      transaction.oncomplete = () => {
        console.log('[SW] Offline queue cleared');
        resolve();
      };
    };
    request.onerror = () => resolve();
  });
}

// オンライン復帰時の同期処理
self.addEventListener('online', () => {
  console.log('[SW] Online again, syncing offline queue...');
  syncOfflineQueue();
});

async function syncOfflineQueue() {
  try {
    const queueItems = await getOfflineQueue();
    
    for (const item of queueItems) {
      try {
        const headers = new Headers(item.headers);
        const request = new Request(item.url, {
          method: item.method,
          headers: headers,
          body: item.body
        });
        
        const response = await fetch(request);
        if (response.ok) {
          console.log('[SW] Synced offline item:', item.url);
        }
      } catch (error) {
        console.error('[SW] Failed to sync item:', item.url, error);
      }
    }
    
    await clearOfflineQueue();
  } catch (error) {
    console.error('[SW] Failed to sync offline queue:', error);
  }
}

async function getOfflineQueue() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('OptOilOfflineDB', 1);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['queue'], 'readonly');
      const store = transaction.objectStore('queue');
      const getRequest = store.getAll();
      
      getRequest.onsuccess = () => {
        resolve(getRequest.result || []);
      };
      getRequest.onerror = () => resolve([]);
    };
    request.onerror = () => resolve([]);
  });
}

// メッセージハンドラー
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'SYNC_OFFLINE_QUEUE') {
    syncOfflineQueue();
  }
});

console.log('[SW] Service Worker loaded');