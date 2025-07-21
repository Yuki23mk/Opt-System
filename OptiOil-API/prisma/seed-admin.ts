import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // 管理者ユーザー作成
  const adminUser = await prisma.adminUser.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: await bcrypt.hash('admin', 10),
      email: 'admin@example.com',
      role: 'super_admin',
      status: 'active',
    },
  });

  console.log('Admin user created:', adminUser);

  // 会社データ作成
  const company1 = await prisma.company.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: '山田製作所',
    },
  });

  const company2 = await prisma.company.upsert({
    where: { id: 2 },
    update: {},
    create: {
      id: 2,
      name: '田中工業',
    },
  });

  console.log('Companies created:', { company1, company2 });

  // 商品マスタ作成
  const product1 = await prisma.adminProductMaster.upsert({
    where: { code: 'OIL-001' },
    update: {},
    create: {
      code: 'OIL-001',
      name: 'スーパー切削油 A',
      manufacturer: '山田油脂工業',
      capacity: '200',
      unit: 'L',
      oilType: '切削油',
      internalTag: '主力商品',
      active: true,
    },
  });

  const product2 = await prisma.adminProductMaster.upsert({
    where: { code: 'OIL-002' },
    update: {},
    create: {
      code: 'OIL-002',
      name: 'マルチ潤滑油 B',
      manufacturer: '田中化学',
      capacity: '18',
      unit: 'L',
      oilType: '潤滑油',
      active: true,
    },
  });

  const product3 = await prisma.adminProductMaster.upsert({
    where: { code: 'OIL-003' },
    update: {},
    create: {
      code: 'OIL-003',
      name: '高性能グリース C',
      manufacturer: '山田油脂工業',
      capacity: '15',
      unit: 'kg',
      oilType: 'グリース',
      internalTag: '新商品',
      active: false,
    },
  });

  console.log('Products created:', { product1, product2, product3 });

  // 会社と商品の関連付け
  // 既存のデータがある場合は削除
  await prisma.companyProduct.deleteMany({});

  // 新規作成
  const companyProducts = await prisma.companyProduct.createMany({
    data: [
      {
        companyId: 1,
        productMasterId: product1.id,
        enabled: true,
        displayOrder: 1,
      },
      {
        companyId: 1,
        productMasterId: product2.id,
        enabled: true,
        displayOrder: 2,
      },
      {
        companyId: 2,
        productMasterId: product2.id,
        enabled: true,
        displayOrder: 1,
      },
    ],
  });

  console.log('CompanyProducts created:', companyProducts);

  // テスト用のユーザーも作成（オプション）
  const testUser = await prisma.user.upsert({
    where: { email: 'test@yamada.com' },
    update: {},
    create: {
      email: 'test@yamada.com',
      password: await bcrypt.hash('password', 10),
      name: '山田太郎',
      companyId: 1,
      systemRole: 'main',
      status: 'active',
    },
  });

  console.log('Test user created:', testUser);

  console.log('Seed data created successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });