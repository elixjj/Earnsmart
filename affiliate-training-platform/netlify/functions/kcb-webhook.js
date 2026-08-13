const { supabaseAdmin, json, parseBody, normalizePhone, uniqueAgentCode } = require('./_utils');

function resultCode(body) {
  return body?.ResultCode ?? body?.resultCode ?? body?.Body?.stkCallback?.ResultCode;
}

function metadataString(body) {
  const candidates = [
    body?.Metadata, body?.metadata, body?.AccountReference,
    body?.accountReference, body?.Body?.stkCallback?.CallbackMetadata?.Metadata
  ];
  for (const value of candidates) {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
      const found = value.find(x => String(x?.Name || '').toLowerCase().includes('account'));
      if (found?.Value) return String(found.Value);
    }
  }
  return '';
}

function callbackPhone(body) {
  const candidates = [
    body?.PhoneNumber, body?.phoneNumber,
    body?.Body?.stkCallback?.CallbackMetadata?.Item
  ];
  for (const value of candidates) {
    if (typeof value === 'string' && /^\+?254/.test(value)) return value;
    if (Array.isArray(value)) {
      const item = value.find(x => String(x?.Name || '').toLowerCase() === 'phonenumber');
      if (item?.Value) return String(item.Value);
    }
  }
  return '';
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' });

  try {
    const body = parseBody(event);
    const code = Number(resultCode(body));
    if (code !== 0) return json(200, { ok: true, ignored: true });

    const metadata = metadataString(body);
    if (!metadata.startsWith('AGENT-')) {
      return json(400, { error: 'Missing AGENT metadata.' });
    }
    const recruiterCode = metadata.slice('AGENT-'.length).trim().toUpperCase();
    const phoneRaw = callbackPhone(body);
    const supabase = supabaseAdmin();

    // Prefer the callback phone; some KCB payloads can omit it, in which case
    // the callback should be extended with the transaction identifier mapping
    // used by the provisioned KCB API product.
    if (!phoneRaw) return json(400, { error: 'Payment callback phone is missing.' });
    const traineePhone = normalizePhone(phoneRaw);

    const { data: trainee, error: traineeError } = await supabase.from('system_users')
      .select('id,name,phone,payment_status')
      .eq('phone', traineePhone)
      .eq('payment_status', 'pending')
      .maybeSingle();

    if (traineeError) throw traineeError;
    if (!trainee) return json(200, { ok: true, message: 'No matching pending trainee.' });

    // Idempotency: do not issue a second commission on duplicate callbacks.
    const { data: prior } = await supabase.from('commissions')
      .select('id')
      .eq('agent_code', recruiterCode)
      .eq('trainee_phone', traineePhone)
      .maybeSingle();

    if (!prior) {
      const { error: commissionError } = await supabase.from('commissions').insert({
        agent_code: recruiterCode,
        trainee_phone: traineePhone,
        amount_earned: 80.00,
        payout_status: 'unpaid'
      });
      if (commissionError) throw commissionError;
    }

    const newCode = await uniqueAgentCode(supabase, trainee.name, trainee.phone);
    const { error: updateError } = await supabase.from('system_users')
      .update({ payment_status: 'paid', assigned_ref_code: newCode })
      .eq('id', trainee.id)
      .eq('payment_status', 'pending');
    if (updateError) throw updateError;

    return json(200, { ok: true, activated: true, agentCode: newCode });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'Webhook processing failed.' });
  }
};
