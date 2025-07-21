import sendgrid from '@sendgrid/mail';

sendgrid.setApiKey(process.env.SENDGRID_API_KEY);

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { to, subject, text } = req.body;
    try {
      await sendgrid.send({
        to,
        from: process.env.SENDGRID_SENDER_EMAIL,
        subject,
        text
      });
      res.status(200).json({ message: 'メール送信成功' });
    } catch (error) {
      res.status(500).json({ message: 'メール送信失敗', error });
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}
