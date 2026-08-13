const { supabaseAdmin, json, parseBody, normalizePhone } = require('./_utils');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' });

  try {
    const { name, phone, refCode } = parseBody(event);
    if (!name || String(name).trim().length < 2) return json(400, { error: 'Valid name is required.' });

    const normalizedPhone = normalizePhone(phone);
    const referredBy = String(refCode || 'DIRECT').trim().toUpperCase() || 'DIRECT';
    const supabase = supabaseAdmin();

    const { data: existing } = await supabase.from('system_users')
      .select('id,payment_status')
      .eq('phone', normalizedPhone)
      .maybeSingle();

    if (existing && existing.payment_status === 'paid') {
      return json(409, { error: 'This phone number is already activated.' });
    }

    let result;
    if (existing) {
      result = await supabase.from('system_users')
        .update({ name: String(name).trim(), referred_by_code: referredBy, payment_status: 'pending' })
        .eq('id', existing.id)
        .select('id')
        .single();
    } else {
      result = await supabase.from('system_users')
        .insert({
          name: String(name).trim(),
          phone: normalizedPhone,
          referred_by_code: referredBy,
          payment_status: 'pending'
        })
        .select('id')
        .single();
    }

    if (result.error) throw result.error;
    return json(200, { ok: true, userId: result.data.id });
  } catch (err) {
    console.error(err);
    return json(500, { error: err.message || 'Registration failed.' });
  }
};
