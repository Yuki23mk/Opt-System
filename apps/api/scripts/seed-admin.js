const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🌱 管理者初期データを作成中...');

    // 既存チェック
    const existing = await prisma.adminUser.findUnique({
      where: { username: 'admin' }
    });

    if (existing) {
      console.log('✅ 管理者ユーザーは既に存在しています');
      console.log('ユーザー名: admin / パスワード: admin123');
      return;
    }

    // パスワードハッシュ化
    const hashedPassword = await bcrypt.hash('admin123', 10);

    // 管理者作成
    const admin = await prisma.adminUser.create({
      data: {
        username: 'admin',
        email: 'admin@optioil.com',
        passwordHash: hashedPassword,
        role: 'super_admin',
        status: 'active'
      }
    });

    console.log('✅ 管理者ユーザーを作成しました!');
    console.log('ユーザー名: admin');
    console.log('パスワード: admin123');
    console.log('ID:', admin.id);

  } catch (error) {
    console.error('❌ エラー:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();