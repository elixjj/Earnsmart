const { supabaseAdmin, json } = require('./_utils');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed.' });

  try {
    const agentCode = String(event.queryStringParameters?.agentCode || '').trim().toUpperCase();
    if (!agentCode) return json(400, { error: 'agentCode is required.' });

    const supabase = supabaseAdmin();

    const { count: totalTrainees, error: traineesError } = await supabase.from('system_users')
      .select('id', { count: 'exact', head: true })
      .eq('referred_by_code', agentCode)
      .eq('payment_status', 'paid');
    if (traineesError) throw traineesError;

    const { data: commissions, error: commissionError } = await supabase.from('commissions')
      .select('id,trainee_phone,amount_earned,payout_status,processed_at')
      .eq('agent_code', agentCode)
      .order('processed_at', { ascending: false });
    if (commissionError) throw commissionError;

    const unpaid = (commissions || [])
      .filter(x => x.payout_status !== 'paid')
      .reduce((sum, x) => sum + Number(x.amount_earned || 0), 0);

    const paid = (commissions || [])
      .filter(x => x.payout_status === 'paid')
      .reduce((sum, x) => sum + Number(x.amount_earned || 0), 0);

    return json(200, {
      agentCode,
      totalTrainees: totalTrainees || 0,
      unpaidCommissionsBalance: Number(unpaid.toFixed(2)),
      totalPaidOutBalance: Number(paid.toFixed(2)),
      history: commissions || []
    });
  } catch (err) {
    console.error(err);
    return json(500, { error: err.message || 'Could not load agent stats.' });
  }
};
