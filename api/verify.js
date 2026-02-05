// api/verify.js
// Vercel Serverless Function
// SECURE: Keys are loaded from Vercel Environment Variables

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

  // 2. LOAD SECRETS FROM ENVIRONMENT (Safe!)
  const API_KEY = process.env.PAYVESSEL_API_KEY;
  const SECRET_KEY = process.env.PAYVESSEL_SECRET_KEY;
  const BUSINESS_ID = process.env.PAYVESSEL_BUSINESS_ID; 
  const BRIDGE_SECRET = process.env.BRIDGE_SECRET; 

  // Check if keys are loaded
  if (!API_KEY || !SECRET_KEY) {
    return response.status(500).json({ status: false, message: "Server Misconfiguration: Missing Keys" });
  }

  // 3. GET REFERENCE ID
  const { ref } = request.query;

  if (!ref) {
    return response.status(400).json({ status: false, message: "Missing Reference ID" });
  }

  // 4. CALL PAYVESSEL
  const url = `https://api.payvessel.com/api/v2/transactions/${ref}`;

  try {
    const apiRes = await fetch(url, {
      method: 'GET',
      headers: {
        'api-key': API_KEY,
        'secret-key': SECRET_KEY,
        'business-id': BUSINESS_ID,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36'
      }
    });

    if (!apiRes.ok) {
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

    // 5. GENERATE SECURITY HASH
    const crypto = require('crypto');
    const rawString = data.reference + data.amount + BRIDGE_SECRET;
    const signature = crypto.createHash('sha256').update(rawString).digest('hex');

    // 6. RETURN SUCCESS
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
