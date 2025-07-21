import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 既存のCompanyProductを取得
  const companyProducts = await prisma.companyProduct.findMany({
    take: 3,
    where: { enabled: true }
  });

  if (companyProducts.length === 0) {
    console.log('CompanyProductが見つかりません');
    return;
  }

  // テスト用スケジュール価格を作成
  const schedules = await Promise.all(
    companyProducts.map((cp, index) => 
      prisma.companyProductPriceSchedule.create({
        data: {
          companyProductId: cp.id,
          scheduledPrice: cp.price ? cp.price * 1.1 : 10000, // 10%値上げ
          effectiveDate: new Date(Date.now() - (index + 1) * 60 * 60 * 1000), // 1-3時間前
          expiryDate: index === 0 ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null,
          isApplied: false
        }
      })
    )
  );

  console.log(`${schedules.length}件のスケジュール価格を作成しました`);
  schedules.forEach(s => {
    console.log(`- CompanyProduct ID: ${s.companyProductId}, 新価格: ${s.scheduledPrice}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());