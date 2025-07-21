const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
 // テストユーザー登録 
   const users = [
     {
       email: "test@example.com",
       password: "$2b$10$7QSQy4hQKjC94yBbi2guU.EmAMBcMCxXieZsTkUr.tVKfbgY1gONK",
       systemRole: "main",
       status: "active",
       name: "真壁 硯",
       company: "ねこカンパニー!",
       companyId: "1",
       department: "総務部",
       position: "MG",
       phone: "090-1234-5679",
     },
     {
       email: "test2@example.com",
       password: "$2b$10$7QSQy4hQKjC94yBbi2guU.EmAMBcMCxXieZsTkUr.tVKfbgY1gONK",
       systemRole: "child",
       status: "active",
       name: "すずりタウン",
       company: "ねこカンパニー!",
       companyId: "1",
       department: null,
       position: null,
       phone: "123-456-7890",
     },
     {
       email: "test2@hoge.com",
       password: "$2b$10$zD0pSEtYy84j0iL.vA4bIOW.h0QYECL5X7hrWuejg8a4bJ8PNoU6S",
       systemRole: "main",
       status: "pending",
       name: "テスト株式会社",
       company: "株式会社ねこ",
       companyId: "11",
       department: "総務部",
       position: "",
       phone: "",
     },
     {
       email: "test@hoge1.com",
       password: "$2b$10$0RKD.8f3S3PL2Lh6nOWx7ucBMFeR8oA26Zrg3fR.CFE8loJkCdoVO",
       systemRole: "main",
       status: "pending",
       name: "真壁 硯2",
       company: "株式会社ねこ",
       companyId: "111",
       department: "総務部",
       position: "",
       phone: "",
     },
     {
       email: "test23@example.com",
       password: "$2b$10$jIt4/8qJNtGHhoksTNfpFO5hRDIz2VoReVqXykxtKFVg5F6UphNj.",
       systemRole: "child",
       status: "active",
       name: "すずりハウス",
       company: "ねこカンパニー!",
       companyId: "1",
       department: "総務部",
       position: "AM",
       phone: "090-1234-5679",
     },
   ];
 
   for (const user of users) {
     const existingUser = await prisma.user.findUnique({
       where: { email: user.email },
     });
 
     if (!existingUser) {
       await prisma.user.create({ data: user });
       console.log(`✅ 追加ユーザー: ${user.email}`);
     } else {
       console.log(`⚠️ 既存ユーザー: ${user.email}`);
     }
   }
  }


main()
.catch(e => {
  console.error(e);
  process.exit(1);
})
.finally(async () => {
  await prisma.$disconnect();
});