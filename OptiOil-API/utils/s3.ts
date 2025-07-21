// OptiOil-API/utils/s3.ts
import AWS from 'aws-sdk';

// AWS SDK設定の初期化
const s3Config: AWS.S3.ClientConfiguration = {
  region: process.env.AWS_REGION || 'ap-northeast-3',
  signatureVersion: 'v4', // 重要：v4署名を明示的に指定
};

// アクセスキーが環境変数にある場合のみ設定（本番環境ではIAMロール使用）
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  // ✅ 非推奨プロパティを修正
  s3Config.credentials = new AWS.Credentials({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  });
}

const s3 = new AWS.S3(s3Config);

// デバッグ用：S3設定の確認
console.log('🔧 S3設定:', {
  region: s3Config.region,
  hasCredentials: !!s3Config.credentials,
  bucket: process.env.AWS_S3_BUCKET,
});

// シンプルなファイルアップロード
export async function uploadFile(
  folder: string,
  fileName: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<{ s3Key: string; s3Url: string }> {
  const timestamp = Date.now();
  
  // ファイル名をURLセーフにエンコード
  const safeFileName = encodeURIComponent(fileName)
    .replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16))
    .replace(/%20/g, '-');
  
  const s3Key = `${folder}/${timestamp}-${safeFileName}`;

  const uploadParams = {
    Bucket: process.env.AWS_S3_BUCKET!,
    Key: s3Key,
    Body: fileBuffer,
    ContentType: mimeType,
    ServerSideEncryption: 'AES256' as const,
    Metadata: {
      // 日本語ファイル名はBase64エンコードして保存
      originalName: Buffer.from(fileName).toString('base64'),
      uploadedAt: new Date().toISOString()
    }
  };

  try {
    console.log('📤 S3アップロード開始:', {
      bucket: uploadParams.Bucket,
      key: s3Key,
      size: fileBuffer.length,
      mimeType
    });

    const result = await s3.upload(uploadParams).promise();
    
    console.log('✅ S3アップロード成功:', {
      location: result.Location,
      key: result.Key
    });

    return {
      s3Key,
      s3Url: result.Location
    };
  } catch (error) {
    console.error('❌ S3アップロードエラー:', error);
    throw new Error('ファイルのアップロードに失敗しました');
  }
}

// テキストファイル（.md, .txt）の内容取得
export async function getTextFileContent(s3Key: string): Promise<string> {
  const params = {
    Bucket: process.env.AWS_S3_BUCKET!,
    Key: s3Key
  };

  try {
    const result = await s3.getObject(params).promise();
    return result.Body?.toString('utf-8') || '';
  } catch (error) {
    console.error('❌ S3ダウンロードエラー:', error);
    throw new Error('ファイルの取得に失敗しました');
  }
}

// ダウンロード用の署名付きURL生成（修正版）
export function generateDownloadUrl(s3Key: string, fileName: string, expiresIn: number = 3600, isPreview: boolean = false): string {
  try {
    // 日本語ファイル名をRFC 5987形式でエンコード
    const encodedFileName = encodeURIComponent(fileName)
      .replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16));
    
    console.log('🔑 署名付きURL生成:', {
      bucket: process.env.AWS_S3_BUCKET,
      key: s3Key,
      expiresIn,
      fileName,
      isPreview
    });

    // プレビューの場合はinline、ダウンロードの場合はattachment
    const disposition = isPreview ? 'inline' : 'attachment';

    const signedUrl = s3.getSignedUrl('getObject', {
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: s3Key,
      Expires: expiresIn,
      ResponseContentDisposition: `${disposition}; filename*=UTF-8''${encodedFileName}`
    });

    console.log('✅ 署名付きURL生成成功');
    
    return signedUrl;
  } catch (error) {
    console.error('❌ 署名付きURL生成エラー:', error);
    throw new Error('ダウンロードURLの生成に失敗しました');
  }
}

// 法的文書のアップロード
export async function uploadLegalDocument(
  type: string,
  version: string,
  content: string
): Promise<{ s3Key: string; s3Url: string }> {
  const timestamp = Date.now();
  const fileName = `${type}-${version}-${timestamp}.md`;
  const s3Key = `legal-documents/${fileName}`;

  const uploadParams = {
    Bucket: process.env.AWS_S3_BUCKET!,
    Key: s3Key,
    Body: Buffer.from(content, 'utf-8'),
    ContentType: 'text/markdown',
    ServerSideEncryption: 'AES256' as const,
    Metadata: {
      documentType: type,
      version: version,
      uploadedAt: new Date().toISOString()
    }
  };

  try {
    const result = await s3.upload(uploadParams).promise();
    return {
      s3Key,
      s3Url: result.Location
    };
  } catch (error) {
    console.error('法的文書アップロードエラー:', error);
    throw new Error('法的文書のアップロードに失敗しました');
  }
}

// 法的文書のコンテンツ取得
export async function getLegalDocumentContent(s3Key: string): Promise<string> {
  const params = {
    Bucket: process.env.AWS_S3_BUCKET!,
    Key: s3Key
  };

  try {
    const result = await s3.getObject(params).promise();
    return result.Body?.toString('utf-8') || '';
  } catch (error) {
    console.error('法的文書ダウンロードエラー:', error);
    throw new Error('法的文書の取得に失敗しました');
  }
}

// ファイル削除関数を追加
export async function deleteFile(s3Key: string): Promise<void> {
  try {
    await s3.deleteObject({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: s3Key
    }).promise();
    console.log('✅ S3ファイル削除成功:', s3Key);
  } catch (error) {
    console.error('❌ S3削除エラー:', error);
    throw new Error('ファイルの削除に失敗しました');
  }
}

// S3 URLからKeyを抽出する関数
export function extractS3KeyFromUrl(s3Url: string): string | null {
  try {
    const url = new URL(s3Url);
    // パスの最初の '/' を除去してKeyを取得
    const key = url.pathname.substring(1);
    return decodeURIComponent(key);
  } catch (error) {
    console.error('❌ S3 URL解析エラー:', error);
    return null;
  }
}

// S3 URLからダウンロードURLを生成（既存のgenerateDownloadUrlのラッパー）
export function generateDownloadUrlFromS3Url(s3Url: string, fileName: string, expiresIn: number = 3600, isPreview: boolean = false): string | null {
  const s3Key = extractS3KeyFromUrl(s3Url);
  if (!s3Key) {
    console.error('❌ S3 URLからKeyを抽出できません:', s3Url);
    return null;
  }
  return generateDownloadUrl(s3Key, fileName, expiresIn, isPreview);
}