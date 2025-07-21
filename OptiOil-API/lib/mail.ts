// lib/mail.ts

// 開発環境では本物のメールは送らずログ出力だけ行う

export async function sendMail({
    to = "admin@example.com",
    subject,
    text,
  }: {
    to?: string;
    subject: string;
    text: string;
  }) {
    console.log("📩 【ダミーメール送信】");
    console.log("To:", to);
    console.log("Subject:", subject);
    console.log("Text:\n" + text);
  
    return { success: true, mocked: true };
  }
  