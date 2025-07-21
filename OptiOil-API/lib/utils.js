import jwt from "jsonwebtoken"; 

const SECRET_KEY = process.env.JWT_SECRET;

// JWT認証チェック用関数
export function verifyToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) throw new Error('トークンが必要です');
  const token = authHeader.split(' ')[1];

  try {
    return jwt.verify(token, SECRET_KEY);
  } catch (err) {
    console.error("JWT検証エラー:", err);
    throw new Error('無効なトークン');
  }
}

// 統一エラーレスポンス関数
export function handleError(res, error) {
  res.status(500).json({ message: 'サーバーエラー', error: error.message });
}
