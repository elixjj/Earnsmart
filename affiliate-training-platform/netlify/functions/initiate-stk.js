const { supabaseAdmin, json, parseBody, normalizePhone } = require('./_utils');

async function getKcbToken() {
  const base = process.env.KCB_BASE_URL || 'https://kcbgroup.com';
  const path = process.env.KCB_TOKEN_PATH || '/oauth/v1/generate?grant_type=client_credentials';
  const key = process.env.KCB_CONSUMER_KEY;
  const secret = process.env.KCB_CONSUMER_SECRET;
  if (!key || !secret) throw new Error('KCB credentials are not configured.');

  const basic = Buffer.from(`${key}:${secret}`).toString('base64');
  const response = await fetch(new URL(path, base), {
    method: 'GET',
    headers: { Authorization: `Basic ${basic}`, Accept: 'application/json' }
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = {}; }
  if (!response.ok) throw new Error(`KCB OAuth failed (${response.status}).`);
  const token = data.access_token || data.token;
  if (!token) throw new Error('KCB OAuth response did not contain an access token.');
  return token;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' });

  try {
    const { name, phone, refCode, registrationId } = parseBody(event);
    const normalizedPhone = normalizePhone(phone);
    const agentCode = String(refCode || 'DIRECT').trim().toUpperCase() || 'DIRECT';

    const supabase = supabaseAdmin();
    const { data: user, error: userError } = await supabase.from('system_users')
      .select('id,name,phone,referred_by_code,payment_status')
      .eq('id', registrationId)
      .eq('phone', normalizedPhone)
      .single();
    if (userError || !user || user.payment_status !== 'pending') {
      return json(400, { error: 'Pending registration could not be verified.' });
    }

    const token = await getKcbToken();
    const base = process.env.KCB_BASE_URL || 'https://kcbgroup.com';
    const path = process.env.KCB_STK_PATH || '/v1/mpesaexpress';

    /*
      KCB Buni API products can expose different field names/envelopes.
      This payload follows the common Mpesa Express structure and keeps the
      endpoint configurable so it can match the exact Buni product contract.
    */
    const payload = {
      BusinessShortCode: '522533',
      Amount: 100,
      PartyA: normalizedPhone,
      PhoneNumber: normalizedPhone,
      TransactionDesc: 'Affiliate Training Registration',
      AccountReference: `AGENT-${agentCode}`,
      Metadata: `AGENT-${agentCode}`,
      name: String(name || user.name).trim(),
      registrationId: user.id
    };

    const response = await fetch(new URL(path, base), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!response.ok) {
      console.error('KCB STK error', response.status, data);
      return json(502, { error: 'KCB payment request failed.' });
    }

    return json(200, {
      ok: true,
      message: 'Check your phone for the M-Pesa PIN prompt popup...',
      request: data
    });
  } catch (err) {
    console.error(err);
    return json(500, { error: err.message || 'STK initiation failed.' });
  }
};
