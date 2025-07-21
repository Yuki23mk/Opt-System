// OptiOil-API/scripts/check-db.js
// このファイルを作成して実行

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    console.log('🔍 データベース整合性チェック開始');
    
    // 全ユーザーを取得
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        companyId: true,
        name: true
      }
    });
    
    console.log(`👥 ユーザー数: ${users.length}`);
    
    // 全会社を取得
    const companies = await prisma.company.findMany({
      select: {
        id: true,
        name: true
      }
    });
    
    console.log(`🏢 会社数: ${companies.length}`);
    
    // 会社IDのリスト
    const companyIds = companies.map(c => c.id);
    console.log('📋 存在する会社ID:', companyIds);
    
    // 存在しない会社IDを参照しているユーザーをチェック
    const orphanUsers = users.filter(user => !companyIds.includes(user.companyId));
    
    if (orphanUsers.length > 0) {
      console.log('❌ 存在しない会社IDを参照しているユーザー:');
      orphanUsers.forEach(user => {
        console.log(`  - ユーザーID: ${user.id}, Email: ${user.email}, 会社ID: ${user.companyId}`);
      });
    } else {
      console.log('✅ 全ユーザーの会社IDは正常です');
    }
    
    // 各ユーザーの詳細チェック
    for (const user of users) {
      try {
        await prisma.user.findUnique({
          where: { id: user.id },
          include: { companyRel: true }
        });
        console.log(`✅ ユーザーID ${user.id}: OK`);
      } catch (error) {
        console.log(`❌ ユーザーID ${user.id}: エラー - ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ チェック中にエラー:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();