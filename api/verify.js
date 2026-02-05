// api/verify.js
// Vercel Serverless Function (Super Stealth Mode)

export default async function handler(request, response) {
  // 1. CORS HEADERS
  response.setHeader('Access-Control-Allow-Credentials', true);
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    response.status(200).end();
    return;
  }

  const API_KEY = process.env.PAYVESSEL_API_KEY;
  const SECRET_KEY = process.env.PAYVESSEL_SECRET_KEY;
  const BUSINESS_ID = process.env.PAYVESSEL_BUSINESS_ID; 
  const BRIDGE_SECRET = process.env.BRIDGE_SECRET; 

  const { ref } = request.query;

  if (!ref) {
    return response.status(400).json({ status: false, message: "Missing Reference ID" });
  }

  const url = `https://api.payvessel.com/api/v2/transactions/${ref}`;

  try {
    const apiRes = await fetch(url, {
      method: 'GET',
      headers: {
        'api-key': API_KEY,
        'secret-key': SECRET_KEY,
        'business-id': BUSINESS_ID,
        'Content-Type': 'application/json',
        // STEALTH HEADERS: Mimic a real Chrome browser on Windows
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0'
      }
    });

    if (!apiRes.ok) {
       // Pass the specific error back so we can see it
       return response.status(apiRes.status).json({ status: false, message: `Bank Error: ${apiRes.status}` });
    }

    const json = await apiRes.json();
    const data = json.transaction || json; 

    if (!data || !data.amount) {
      return response.status(404).json({ status: false, message: "Transaction not found" });
    }

    const status = (data.status || "").toLowerCase();
    if (!status.includes("success")) {
       return response.status(400).json({ status: false, message: "Transaction was not successful" });
    }

    const crypto = require('crypto');
    const rawString = data.reference + data.amount + BRIDGE_SECRET;
    const signature = crypto.createHash('sha256').update(rawString).digest('hex');

    return response.status(200).json({
      status: true,
      data: [{
        reference: data.reference,
        amount: data.amount,
        signature: signature
      }]
    });

  } catch (error) {
    return response.status(500).json({ status: false, message: error.message });
  }
}
