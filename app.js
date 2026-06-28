const express = require('express');
const axios = require('axios');
const PDFDocument = require('pdfkit');
const FormData = require('form-data');
const app = express();

const WA_TOKEN = process.env.WA_TOKEN;
const WA_PHONE_ID = process.env.WA_PHONE_ID;
const WA_VERIFY_TOKEN = process.env.WA_VERIFY_TOKEN || 'luchy_secret_2025';

app.use('/webhook/shopify', express.raw({ type: 'application/json' }));
app.use(express.json());

// ===========================
// إرسال رسالة نصية
// ===========================
async function sendWA(phone, message) {
  try {
    let cleaned = phone.replace(/[^0-9]/g, '');
    if (!cleaned.startsWith('974')) cleaned = '974' + cleaned;
    await axios.post(
      `https://graph.facebook.com/v18.0/${WA_PHONE_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: cleaned,
        type: 'text',
        text: { body: message }
      },
      { headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' } }
    );
    console.log(`✅ رسالة أُرسلت إلى ${cleaned}`);
  } catch (err) {
    console.error('❌ خطأ في الإرسال:', err.response?.data || err.message);
  }
}

// ===========================
// إنشاء وإرسال فاتورة PDF
// ===========================
async function sendInvoicePDF(phone, order) {
  try {
    let cleaned = phone.replace(/[^0-9]/g, '');
    if (!cleaned.startsWith('974')) cleaned = '974' + cleaned;

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));

    await new Promise((resolve) => {
      doc.on('end', resolve);

      // رأس الفاتورة
      doc.fontSize(32).fillColor('#1a1a1a').text('LUCHY', { align: 'center' });
      doc.fontSize(11).fillColor('#999').text('luchyline.com | Luchy@luchyline.com', { align: 'center' });
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#f0c0c0').lineWidth(2).stroke();
      doc.moveDown(0.8);

      // تفاصيل الفاتورة
      doc.fontSize(22).fillColor('#1a1a1a').text('INVOICE', { align: 'right' });
      doc.fontSize(11).fillColor('#666');
      doc.text(`Invoice No: ${order.name}`, { align: 'right' });
      doc.text(`Date: ${new Date().toLocaleDateString('en-QA')}`, { align: 'right' });
      doc.moveDown(1);

      // اسم العميل
      doc.fontSize(13).fillColor('#1a1a1a').text(`Dear ${order.customer?.first_name || 'Valued Customer'},`, { align: 'left' });
      doc.fontSize(11).fillColor('#888').text('Thank you for choosing Luchy. Here is your invoice.', { align: 'left' });
      doc.moveDown(1);

      // خط فاصل
      doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#eee').lineWidth(1).stroke();
      doc.moveDown(0.5);

      // عناوين الجدول
      doc.fontSize(10).fillColor('#999');
      doc.text('TOTAL', 50, doc.y, { width: 100 });
      doc.text('QTY', 160, doc.y - 12, { width: 60 });
      doc.text('PRICE', 230, doc.y - 12, { width: 80 });
      doc.text('ITEM', 350, doc.y - 12, { width: 200 });
      doc.moveDown(0.3);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#eee').stroke();
      doc.moveDown(0.5);

      // المنتجات
      let subtotal = 0;
      order.line_items?.forEach(item => {
        const itemTotal = parseFloat(item.price) * item.quantity;
        subtotal += itemTotal;
        doc.fontSize(11).fillColor('#1a1a1a');
        doc.text(`${itemTotal.toFixed(2)} QAR`, 50, doc.y, { width: 100 });
        doc.text(`${item.quantity}`, 160, doc.y - 12, { width: 60 });
        doc.text(`${parseFloat(item.price).toFixed(2)} QAR`, 230, doc.y - 12, { width: 80 });
        doc.text(item.name, 350, doc.y - 12, { width: 200 });
        doc.moveDown(0.6);
      });

      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#eee').stroke();
      doc.moveDown(0.5);

      // الإجماليات
      const shipping = parseFloat(order.total_shipping_price_set?.shop_money?.amount || 0);
      const discount = parseFloat(order.total_discounts || 0);
      const total = parseFloat(order.total_price);

      doc.fontSize(11).fillColor('#666');
      doc.text(`Subtotal: ${subtotal.toFixed(2)} QAR`, { align: 'right' });
      if (shipping > 0) doc.text(`Shipping: ${shipping.toFixed(2)} QAR`, { align: 'right' });
      if (discount > 0) doc.text(`Discount: -${discount.toFixed(2)} QAR`, { align: 'right' });

      doc.moveTo(350, doc.y + 5).lineTo(550, doc.y + 5).strokeColor('#f0c0c0').lineWidth(1.5).stroke();
      doc.moveDown(0.8);
      doc.fontSize(16).fillColor('#1a1a1a').font('Helvetica-Bold');
      doc.text(`TOTAL: ${total.toFixed(2)} QAR`, { align: 'right' });

      doc.moveDown(3);

      // تذييل
      doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#f0c0c0').lineWidth(2).stroke();
      doc.moveDown(0.8);
      doc.fontSize(10).fillColor('#bbb').font('Helvetica');
      doc.text('All sales are final. No returns or exchanges after order completion.', { align: 'center' });
      doc.text('For inquiries: Luchy@luchyline.com | luchyline.com', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(12).fillColor('#e0a0a0').text('Thank you for choosing Luchy 🌸', { align: 'center' });

      doc.end();
    });

    const pdfBuffer = Buffer.concat(chunks);

    // رفع PDF
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', 'application/pdf');
    form.append('file', pdfBuffer, {
      filename: `Luchy-Invoice-${order.name}.pdf`,
      contentType: 'application/pdf'
    });

    const uploadRes = await axios.post(
      `https://graph.facebook.com/v18.0/${WA_PHONE_ID}/media`,
      form,
      { headers: { ...form.getHeaders(), Authorization: `Bearer ${WA_TOKEN}` } }
    );

    const mediaId = uploadRes.data.id;

    // إرسال PDF
    await axios.post(
      `https://graph.facebook.com/v18.0/${WA_PHONE_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: cleaned,
        type: 'document',
        document: {
          id: mediaId,
          filename: `Luchy-Invoice-${order.name}.pdf`,
          caption: `🧾 Your invoice from Luchy\nOrder: ${order.name}\nTotal: ${order.total_price} QAR\n\nThank you for choosing Luchy 🌸`
        }
      },
      { headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' } }
    );

    console.log(`✅ فاتورة PDF أُرسلت إلى ${cleaned}`);
  } catch (err) {
    console.error('❌ خطأ في إرسال الفاتورة:', err.response?.data || err.message);
  }
}

// ===========================
// Shopify Webhook - طلب جديد
// ===========================
app.post('/webhook/shopify/orders/create', async (req, res) => {
  res.sendStatus(200);
  try {
    const order = JSON.parse(req.body);
    console.log('📦 طلب جديد:', order.name);
    const phone = order.phone || order.customer?.phone || order.billing_address?.phone || order.shipping_address?.phone;
    if (!phone) { console.log('⚠️ لا يوجد رقم هاتف'); return; }
    console.log('📱 إرسال فاتورة لـ:', phone);
    setTimeout(() => sendInvoicePDF(phone, order), 15000);
  } catch (err) {
    console.error('❌ خطأ:', err.message);
  }
});

// ===========================
// Webhook Verification - Meta
// ===========================
app.get('/webhook/whatsapp', (req, res) => {
  if (req.query['hub.verify_token'] === WA_VERIFY_TOKEN)
    return res.send(req.query['hub.challenge']);
  res.sendStatus(403);
});

// ===========================
// المحادثة الذكية التلقائية
// ===========================
app.post('/webhook/whatsapp', async (req, res) => {
  res.sendStatus(200);
  try {
    const msg = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg || msg.type !== 'text') return;
    const from = msg.from;
    const m = msg.text.body.trim().toLowerCase();
    console.log(`💬 رسالة من ${from}: ${m}`);

    let reply;

    if (m.includes('مرحب') || m.includes('هلا') || m.includes('السلام') || m === 'hi' || m === 'hello' || m === 'مرحبا' || m === 'اهلا' || m === 'أهلا')
      reply = `وعليكم السلام ورحمة الله 👋\n\nأهلاً بك في عالم Luchy 🌸\n\nعزيزتي، كيف يمكنني مساعدتك؟\n\n1️⃣ تشكيلة العبايات\n2️⃣ تتبع طلبي\n3️⃣ مقاسات العبايات\n4️⃣ سياسة الطلبات\n5️⃣ التواصل معنا`;

    else if (m.includes('عباية') || m.includes('تشكيلة') || m.includes('منتج') || m.includes('سعر') || m === '1')
      reply = `🌸 تشكيلتنا الراقية من العبايات\n\nتفضلي بزيارة متجرنا:\nhttps://luchyline.com\n\nإطلالات تليق بك ✨\nكل قطعة صُممت بعناية لتعكس أناقتك 👗`;

    else if (m.includes('تتبع') || m.includes('طلب') || m.includes('وين') || m.includes('أين') || m === '2')
      reply = `📦 تتبع طلبك\n\nعزيزتي، أرسلي رقم طلبك وسنتحقق فوراً ✅\n\nمثال: #1234\n\nأو تابعي طلبك مباشرة:\nhttps://luchyline.com/account`;

    else if (m.includes('مقاس') || m.includes('سايز') || m.includes('size') || m === '3')
      reply = `📏 دليل المقاسات\n\nS  ← 36-38\nM  ← 40-42\nL  ← 44-46\nXL ← 48-50\n\nللمساعدة في اختيار مقاسك راسلينا 🌸\n📧 Luchy@luchyline.com`;

    else if (m.includes('إرجاع') || m.includes('ارجاع') || m.includes('استرداد') || m.includes('استبدال') || m === '4')
      reply = `📋 سياسة الطلبات\n\nعزيزتي 🌸\n\n❌ لا يوجد إرجاع أو استبدال بعد إتمام الطلب\n\n✅ للاستفسار قبل الشراء راسلينا:\n📧 Luchy@luchyline.com\n\nوسنساعدك في اختيار المقاس المناسب ✨`;

    else if (m.includes('تواصل') || m.includes('مساعدة') || m.includes('contact') || m === '5')
      reply = `💌 تواصلي معنا\n\n📧 Luchy@luchyline.com\n\n🌐 luchyline.com\n\nسيتواصل معك فريق Luchy قريباً ⏱️\nنحن هنا لخدمتك دائماً 🌸`;

    else if (m.startsWith('#') || /^\d{4,}$/.test(m))
      reply = `🔍 جاري البحث عن طلبك...\n\nعزيزتي، للتتبع الفوري زوري:\nhttps://luchyline.com/account\n\nأو سيتواصل معك فريقنا قريباً ✅\nLuchy يهتم بك 🌸`;

    else
      reply = `✨ أهلاً بك في Luchy\n\nعزيزتي، كيف يمكنني مساعدتك؟ 🌸\n\n1️⃣ تشكيلة العبايات\n2️⃣ تتبع طلبي\n3️⃣ مقاسات العبايات\n4️⃣ سياسة الطلبات\n5️⃣ التواصل معنا`;

    await sendWA(from, reply);
  } catch (err) {
    console.error('❌ خطأ في المحادثة:', err.message);
  }
});

app.get('/', (req, res) => res.json({ status: '✅ Luchy Bot يعمل! 🌸', version: '2.0' }));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`✅ Luchy Bot v2.0 يعمل على المنفذ ${port}`));
