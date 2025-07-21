import twilio from 'twilio';

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { to, message } = req.body;
    try {
      await twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to
      });
      res.status(200).json({ message: 'SMS送信成功' });
    } catch (error) {
      res.status(500).json({ message: 'SMS送信失敗', error });
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}
