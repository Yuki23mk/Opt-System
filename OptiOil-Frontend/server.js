const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();
const port = process.env.PORT || 3000;

// グレースフルシャットダウンの実装：PM2の自動再起動時のポート競合を防ぐ
let server;

const startServer = async () => {
  try {
    await app.prepare();
    
    server = createServer((req, res) => {
      const parsedUrl = parse(req.url, true);
      handle(req, res, parsedUrl);
    });

    server.listen(port, (err) => {
      if (err) throw err;
      console.log(`> Ready on http://localhost:${port}`);
      
      // PM2に準備完了を通知
      if (process.send) {
        process.send('ready');
      }
    });

    // エラーハンドリング
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use`);
        process.exit(1);
      }
      throw err;
    });

  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
};

// グレースフルシャットダウン
const gracefulShutdown = (signal) => {
  console.log(`${signal} signal received: closing HTTP server`);
  
  if (server) {
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
    
    // 30秒後に強制終了
    setTimeout(() => {
      console.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 30000);
  }
};

// シグナルハンドラー
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// 未処理エラーのハンドリング
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// サーバー起動
startServer();