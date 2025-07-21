require('dotenv').config();
const AWS = require('aws-sdk');

// 既存の認証情報を使用
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

async function checkPermissions() {
  console.log('🔍 S3権限チェック中...\n');
  
  const results = {
    listBuckets: false,
    headBucket: false,
    listObjects: false,
    putObject: false,
    getObject: false,
    deleteObject: false
  };

  // 1. バケット一覧の取得
  try {
    await s3.listBuckets().promise();
    results.listBuckets = true;
    console.log('✅ listBuckets: 権限あり');
  } catch (error) {
    console.log('❌ listBuckets: 権限なし', error.code);
  }

  // 2. バケットの存在確認
  try {
    await s3.headBucket({ Bucket: process.env.AWS_S3_BUCKET }).promise();
    results.headBucket = true;
    console.log('✅ headBucket: 権限あり');
  } catch (error) {
    console.log('❌ headBucket: 権限なし', error.code);
  }

  // 3. オブジェクト一覧の取得
  try {
    await s3.listObjectsV2({ 
      Bucket: process.env.AWS_S3_BUCKET,
      MaxKeys: 1 
    }).promise();
    results.listObjects = true;
    console.log('✅ listObjects: 権限あり');
  } catch (error) {
    console.log('❌ listObjects: 権限なし', error.code);
  }

  // 4. オブジェクトのアップロード
  try {
    await s3.putObject({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: 'test/permission-check.txt',
      Body: 'test',
      ContentType: 'text/plain'
    }).promise();
    results.putObject = true;
    console.log('✅ putObject: 権限あり');
  } catch (error) {
    console.log('❌ putObject: 権限なし', error.code);
  }

  // 5. オブジェクトの取得
  try {
    await s3.getObject({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: 'test/permission-check.txt'
    }).promise();
    results.getObject = true;
    console.log('✅ getObject: 権限あり');
  } catch (error) {
    console.log('❌ getObject: 権限なし', error.code);
  }

  // 6. オブジェクトの削除
  try {
    await s3.deleteObject({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: 'test/permission-check.txt'
    }).promise();
    results.deleteObject = true;
    console.log('✅ deleteObject: 権限あり');
  } catch (error) {
    console.log('❌ deleteObject: 権限なし', error.code);
  }

  console.log('\n📊 権限サマリー:');
  console.log(results);
  
  // 必要な権限が不足している場合の対処法
  if (!results.putObject) {
    console.log('\n⚠️  putObject権限がありません。');
    console.log('💡 解決策:');
    console.log('1. AWSコンソールでIAMユーザーに S3 PutObject 権限を追加');
    console.log('2. または、EC2インスタンス上でIAMロールを使用');
  }
}

checkPermissions();