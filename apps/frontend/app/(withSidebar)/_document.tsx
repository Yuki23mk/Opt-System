// /pages/_document.tsx - PWAメタタグとService Worker登録

import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="ja">
      <Head>
        {/* PWA メタタグ */}
        <meta name="application-name" content="OptiOil データモニター" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="OptiOil" />
        <meta name="description" content="製造業向け油剤データ管理システム" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#000000" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, user-scalable=no, viewport-fit=cover" />

        {/* Apple Touch Icons */}
        <link rel="apple-touch-icon" href="/icons/icon-152x152.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-152x152.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-180x180.png" />

        {/* Favicon */}
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/icon-16x16.png" />
        <link rel="shortcut icon" href="/favicon.ico" />

        {/* Manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* Preconnect for performance */}
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_API_URL} />
        <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_API_URL} />

        {/* スプラッシュスクリーン（iOS対応） */}
        <link
          rel="apple-touch-startup-image"
          href="/splash/apple-splash-2048-2732.jpg"
          media="(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/splash/apple-splash-1668-2388.jpg"
          media="(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/splash/apple-splash-1536-2048.jpg"
          media="(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/splash/apple-splash-1125-2436.jpg"
          media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/splash/apple-splash-1242-2208.jpg"
          media="(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/splash/apple-splash-750-1334.jpg"
          media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/splash/apple-splash-640-1136.jpg"
          media="(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
        />

        {/* Service Worker 登録スクリプト */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Service Worker登録
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js', { scope: '/' })
                    .then(function(registration) {
                      console.log('SW registered: ', registration);
                      
                      // 更新チェック
                      registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        newWorker.addEventListener('statechange', () => {
                          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // 新しいバージョンが利用可能な場合の通知
                            if (confirm('アプリの新しいバージョンが利用可能です。更新しますか？')) {
                              newWorker.postMessage({ action: 'skipWaiting' });
                              window.location.reload();
                            }
                          }
                        });
                      });
                    })
                    .catch(function(registrationError) {
                      console.log('SW registration failed: ', registrationError);
                    });
                });

                // Service Workerの更新を監視
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                  window.location.reload();
                });
              }

              // オンライン/オフライン状態の監視
              function updateOnlineStatus() {
                if (navigator.onLine) {
                  console.log('オンラインに復帰しました');
                  document.body.classList.remove('offline');
                  document.body.classList.add('online');
                  
                  // オフラインキューの同期処理をトリガー
                  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                    navigator.serviceWorker.controller.postMessage({ action: 'SYNC_OFFLINE_QUEUE' });
                  }
                  
                  // ユーザーに通知（toastが利用可能な場合）
                  if (typeof window !== 'undefined' && window.toast) {
                    window.toast('オンラインに復帰しました', {
                      description: 'データの同期を開始します',
                      duration: 3000,
                    });
                  }
                } else {
                  console.log('オフラインになりました');
                  document.body.classList.remove('online');
                  document.body.classList.add('offline');
                  
                  // ユーザーに通知
                  if (typeof window !== 'undefined' && window.toast) {
                    window.toast('オフラインモードです', {
                      description: 'データはローカルに保存され、オンライン復帰時に同期されます',
                      duration: 5000,
                    });
                  }
                }
              }

              window.addEventListener('online', updateOnlineStatus);
              window.addEventListener('offline', updateOnlineStatus);

              // PWAインストールプロンプト
              let deferredPrompt;
              window.addEventListener('beforeinstallprompt', (e) => {
                console.log('PWA install prompt triggered');
                e.preventDefault();
                deferredPrompt = e;
                
                // インストールボタンを表示
                const installButton = document.getElementById('install-button');
                if (installButton) {
                  installButton.style.display = 'block';
                  installButton.addEventListener('click', () => {
                    installButton.style.display = 'none';
                    deferredPrompt.prompt();
                    deferredPrompt.userChoice.then((choiceResult) => {
                      if (choiceResult.outcome === 'accepted') {
                        console.log('User accepted the install prompt');
                      } else {
                        console.log('User dismissed the install prompt');
                      }
                      deferredPrompt = null;
                    });
                  });
                }
              });

              // PWAがインストールされた時の処理
              window.addEventListener('appinstalled', (evt) => {
                console.log('PWA was installed');
                if (typeof window !== 'undefined' && window.toast) {
                  window.toast('アプリがインストールされました', {
                    description: 'OptiOilをご利用いただきありがとうございます',
                    duration: 3000,
                  });
                }
              });

              // iOS Safari用のスタンドアロンモード検出
              if (window.navigator.standalone) {
                console.log('Running in standalone mode');
                document.body.classList.add('standalone');
              }

              // 初期状態の設定
              document.addEventListener('DOMContentLoaded', () => {
                updateOnlineStatus();
                
                // オフライン用のスタイルを追加
                const style = document.createElement('style');
                style.textContent = \`
                  .offline-indicator {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    background: #f59e0b;
                    color: white;
                    text-align: center;
                    padding: 8px;
                    z-index: 9999;
                    font-size: 14px;
                    transform: translateY(-100%);
                    transition: transform 0.3s ease;
                  }
                  
                  body.offline .offline-indicator {
                    transform: translateY(0);
                  }
                  
                  .install-prompt {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    background: #000;
                    color: #fff;
                    border: none;
                    border-radius: 8px;
                    padding: 12px 16px;
                    cursor: pointer;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                    z-index: 1000;
                    font-size: 14px;
                    transition: opacity 0.3s ease;
                  }
                  
                  .install-prompt:hover {
                    background: #333;
                  }
                \`;
                document.head.appendChild(style);
                
                // オフライン通知バーを追加
                const offlineIndicator = document.createElement('div');
                offlineIndicator.className = 'offline-indicator';
                offlineIndicator.textContent = 'オフラインモード - データはローカルに保存されます';
                document.body.appendChild(offlineIndicator);
              });
            `,
          }}
        />
      </Head>
      <body>
        <Main />
        <NextScript />
        
        {/* PWAインストールボタン */}
        <button
          id="install-button"
          className="install-prompt"
          style={{ display: 'none' }}
        >
          📱 アプリをインストール
        </button>
      </body>
    </Html>
  );
}