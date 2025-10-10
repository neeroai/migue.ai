import crypto from 'crypto';

// Test payload simulating WhatsApp message
const payload = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "215863621610966",
      changes: [
        {
          value: {
            messaging_product: "whatsapp",
            metadata: {
              display_phone_number: "15550561234",
              phone_number_id: "215863621610966"
            },
            contacts: [
              {
                profile: {
                  name: "Test User"
                },
                wa_id: "+5215512345678"
              }
            ],
            messages: [
              {
                from: "+5215512345678",
                id: `wamid.test_${Date.now()}`,
                timestamp: Math.floor(Date.now() / 1000).toString(),
                text: {
                  body: "Test message"
                },
                type: "text"
              }
            ]
          },
          field: "messages"
        }
      ]
    }
  ]
};

const body = JSON.stringify(payload);

// Generate signature
const appSecret = '29afa077bd63316b422417bc3914cc62';
const signature = crypto
  .createHmac('sha256', appSecret)
  .update(body)
  .digest('hex');

console.log('Testing webhook with payload...');
console.log('Signature:', signature);

// Make request
fetch('http://localhost:3000/api/whatsapp/webhook', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Hub-Signature-256': `sha256=${signature}`
  },
  body: body
})
  .then(res => res.text())
  .then(text => {
    console.log('Response:', text);
  })
  .catch(err => {
    console.error('Error:', err);
  });