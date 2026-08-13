const { createClient } = require('@supabase/supabase-js');

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase environment variables are not configured.');
  return createClient(url, key, { auth: { persistSession: false } });
}

function json(statusCode, body, extraHeaders = {}) {
  const origin = process.env.ALLOWED_ORIGIN || '*';
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      ...extraHeaders
    },
    body: JSON.stringify(body)
  };
}

function parseBody(event) {
  try { return event.body ? JSON.parse(event.body) : {}; }
  catch { return {}; }
}

function normalizePhone(phone) {
  const p = String(phone || '').replace(/\s+/g, '').replace(/^\+/, '');
  if (/^07\d{8}$/.test(p) || /^01\d{8}$/.test(p)) return '254' + p.slice(1);
  if (/^254\d{9}$/.test(p)) return p;
  throw new Error('Invalid Kenyan mobile phone number.');
}

function initials(name) {
  return String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(x => x[0].toUpperCase())
    .join('') || 'AG';
}

function agentCode(name, phone) {
  return `${initials(name)}${String(phone).slice(-4)}`;
}

async function uniqueAgentCode(supabase, name, phone) {
  const base = agentCode(name, phone);
  for (let i = 0; i < 20; i++) {
    const code = i === 0 ? base : `${base}${i}`;
    const { data, error } = await supabase.from('system_users')
      .select('id').eq('assigned_ref_code', code).limit(1);
    if (error) throw error;
    if (!data || data.length === 0) return code;
  }
  throw new Error('Could not generate a unique agent code.');
}

module.exports = {
  supabaseAdmin, json, parseBody, normalizePhone, uniqueAgentCode
};
