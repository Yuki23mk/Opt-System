// OptiOil-API/scripts/fix-db.js
// このファイルを作成して実行

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixDatabase() {
  try {
    console.log('🔧 データベース修正開始');
    
    // 全ユーザーを取得
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        companyId: true,
        name: true
      }
    });
    
    // 全会社を取得
    const companies = await prisma.company.findMany();
    const companyIds = companies.map(c => c.id);
    
    // 存在しない会社IDを参照しているユーザーを特定
    const orphanUsers = users.filter(user => !companyIds.includes(user.companyId));
    
    if (orphanUsers.length > 0) {
      console.log(`❌ ${orphanUsers.length}人のユーザーが存在しない会社IDを参照しています`);
      
      // デフォルト会社を作成または取得
      let defaultCompany = await prisma.company.findFirst();
      
      if (!defaultCompany) {
        console.log('🏢 デフォルト会社を作成します');
        defaultCompany = await prisma.company.create({
          data: {
            name: 'デフォルト会社'
          }
        });
        console.log(`✅ デフォルト会社を作成しました (ID: ${defaultCompany.id})`);
      }
      
      // 孤立ユーザーをデフォルト会社に移動
      for (const user of orphanUsers) {
        console.log(`🔄 ユーザー「${user.name}」(ID: ${user.id})を会社ID ${user.companyId} から ${defaultCompany.id} に移動`);
        
        await prisma.user.update({
          where: { id: user.id },
          data: { companyId: defaultCompany.id }
        });
      }
      
      console.log('✅ 全ての孤立ユーザーを修正しました');
    }
    
    // 修正後の確認
    console.log('🔍 修正後の確認...');
    const fixedUsers = await prisma.user.findMany({
      include: { companyRel: true },
      take: 5
    });
    
    console.log('✅ 修正完了！サンプルユーザー:');
    fixedUsers.forEach(user => {
      console.log(`  - ${user.name}: 会社「${user.companyRel.name}」`);
    });
    
  } catch (error) {
    console.error('❌ 修正中にエラー:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixDatabase();