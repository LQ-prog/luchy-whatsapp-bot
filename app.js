const express = require('express');
const axios = require('axios');
const app = express();

const WA_TOKEN = process.env.WA_TOKEN;
const WA_PHONE_ID = process.env.WA_PHONE_ID;
const WA_VERIFY_TOKEN = process.env.WA_VERIFY_TOKEN || 'luchy_secret_2025';
const STORE_NAME = 'Luchy';
const CURRENCY = 'QAR';

app.use('/webhook/shopify', express.raw({ type: 'application/json' }));
app.use(express.json());

async function sendWA(phone, message) {
  try {
    let cleaned = phone.replace(/[^0-9]/g, '');
    if (!cleaned.startsWith('974')) cleaned = '974' + cleaned;
    await axios.post(
      `https://graph.facebook.com/v18.0/${WA_PHONE_ID}/messages`,
      { messaging_product: 'whatsapp', to: cleaned, type: 'text', text: { body: message } },
      { headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' } }
    );
    console.log(`✅ رسالة أُرسلت إلى ${cleaned}`);
  } catch (err) {
    console.error('❌ خطأ:', err.response?.data || err.message);
  }
}

app.post('/webhook/shopify/orders/create', async (req, res) => {
  res.sendStatus(200);
  const order = JSON.parse(req.body);
  const phone = order.customer?.phone || order.billing_address?.phone;
  if (!phone) return;
  const name = order.customer?.first_name || 'عزيزتي';
  const items = order.line_items.map(i => `• ${i.name} × ${i.quantity} — ${i.price} ${CURRENCY}`).join('\n');
  await sendWA(phone, `✨ أهلاً بك في عالم Luchy\n\nعزيزتي ${name} 🌸\n\nتم استلام طلبك بنجاح 🎀\n\n📋 طلب #${order.order_number}\n${items}\n\n💰 الإجمالي: ${order.total_price} ${CURRENCY}\n\nسيتم التواصل معك لتأكيد التوصيل 🚚\nشكراً لاختيارك Luchy ✨`);
  setTimeout(() => sendWA(phone, `🧾 فاتورتك من Luchy\n\nعزيزتي ${name}\n\nرقم الفاتورة: #${order.order_number}\n${items}\n\n💰 الإجمالي: ${order.total_price} ${CURRENCY}\n\nluchyline.com 🌸`), 10000);
});

app.post('/webhook/shopify/orders/fulfilled', async (req, res) => {
  res.sendStatus(200);
  const order = JSON.parse(req.body);
  const phone = order.customer?.phone || order.billing_address?.phone;
  if (!phone) return;
  const name = order.customer?.first_name || 'عزيزتي';
  const tracking = order.fulfillments?.[0]?.tracking_number || 'سيُرسل قريباً';
  await sendWA(phone, `🚚 طلبك في الطريق إليكِ!\n\nعزيزتي ${name} 🌸\n\nرقم الطلب: #${order.order_number}\nرقم التتبع: ${tracking}\n\nنتمنى أن تكوني أول من يرتدي إطلالتك الجديدة ✨\nLuchy 🎀`);
});

app.get('/webhook/whatsapp', (req, res) => {
  if (req.query['hub.verify_token'] === WA_VERIFY_TOKEN)
    return res.send(req.query['hub.challenge']);
  res.sendStatus(403);
});

app.post('/webhook/whatsapp', async (req, res) => {
  res.sendStatus(200);
  const msg = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!msg || msg.type !== 'text') return;
  const m = msg.text.body.toLowerCase();
  let reply = `✨ أهلاً بك في Luchy\n\nعزيزتي، كيف يمكنني مساعدتك؟ 🌸\n\n1️⃣ تشكيلة العبايات\n2️⃣ تتبع طلبي\n3️⃣ مقاسات العبايات\n4️⃣ التواصل معنا`;
  if (m.includes('عباية') || m.includes('تشكيلة') || m === '1')
    reply = `🌸 تشكيلتنا الراقية من العبايات\n\nتفضلي بزيارة متجرنا:\nhttps://luchyline.com\n\nإطلالات تليق بك ✨`;
  if (m.includes('تتبع') || m.includes('طلب') || m === '2')
    reply = `📦 عزيزتي\n\nأرسلي رقم طلبك وسنتحقق فوراً ✅`;
  if (m.includes('مقاس') || m.includes('سايز') || m === '3')
    reply = `📏 دليل المقاسات\n\nS — 36-38\nM — 40-42\nL — 44-46\nXL — 48-50\n\nللاستفسار عن مقاس معين راسلينا 🌸`;
  if (m.includes('تواصل') || m.includes('مساعدة') || m === '4')
    reply = `💌 سيتواصل معك فريق Luchy قريباً\n\nأو راسلينا على:\n📧 Luchy@luchyline.com\n🌐 luchyline.com ✨`;
  if (m.includes('إرجاع') || m.includes('ارجاع') || m.includes('استرداد') || m.includes('استبدال'))
    reply = `عزيزتي 🌸\n\nنأسف، لا يوجد إرجاع أو استبدال بعد إتمام الطلب.\n\nللاستفسار قبل الشراء راسلينا:\n📧 Luchy@luchyline.com\n\nوسنساعدك في اختيار المقاس المناسب ✨`;
  await sendWA(msg.from, reply);
});

app.get('/', (req, res) => res.json({ status: '✅ Luchy Bot يعمل! 🌸' }));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`✅ Luchy Bot يعمل على المنفذ ${port}`));
