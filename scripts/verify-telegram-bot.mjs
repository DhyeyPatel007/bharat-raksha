// scripts/verify-telegram-bot.mjs
// Live end-to-end simulation of the merchant Telegram bot on http://localhost:3100

const BASE = 'http://localhost:3100';

async function postWebhook(payload) {
  const res = await fetch(`${BASE}/api/upi/webhooks/telegram`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return { status: res.status, json: await res.json() };
}

async function main() {
  console.log('--- 1. Testing /start registration ---');
  const startRes = await postWebhook({
    update_id: 10001,
    message: {
      message_id: 1,
      chat: { id: 987654321, type: 'private', first_name: 'Dhyey' },
      text: '/start',
    },
  });
  console.log('/start response:', startRes);

  console.log('\n--- 2. Testing /status command ---');
  const statusRes = await postWebhook({
    update_id: 10002,
    message: {
      message_id: 2,
      chat: { id: 987654321, type: 'private' },
      text: '/status',
    },
  });
  console.log('/status response:', statusRes);

  console.log('\n--- 3. Testing unauthorized callback query rejection ---');
  const unauthRes = await postWebhook({
    update_id: 10003,
    callback_query: {
      id: 'cb_unauth_01',
      from: { id: 111222, first_name: 'Attacker' },
      message: { message_id: 50, chat: { id: 111222, type: 'private' } },
      data: 'approve:UPI-CASE-B',
    },
  });
  console.log('Unauthorized callback response:', unauthRes);

  console.log('\n--- 4. Testing merchant details callback ---');
  const detailsRes = await postWebhook({
    update_id: 10004,
    callback_query: {
      id: 'cb_details_01',
      from: { id: 987654321, first_name: 'Dhyey' },
      message: { message_id: 51, chat: { id: 987654321, type: 'private' } },
      data: 'details:UPI-CASE-B',
    },
  });
  console.log('Details callback response:', detailsRes);

  console.log('\n--- 5. Testing merchant approve callback ---');
  const approveRes = await postWebhook({
    update_id: 10005,
    callback_query: {
      id: 'cb_approve_01',
      from: { id: 987654321, first_name: 'Dhyey' },
      message: { message_id: 52, chat: { id: 987654321, type: 'private' } },
      data: 'approve:UPI-CASE-B',
    },
  });
  console.log('Approve callback response:', approveRes);

  console.log('\n--- 6. Checking case state on /api/upi/cases ---');
  const casesRes = await fetch(`${BASE}/api/upi/cases`);
  const casesData = await casesRes.json();
  const caseB = casesData.cases.find((c) => c.case_id === 'UPI-CASE-B');
  console.log('Case B state:', {
    case_id: caseB.case_id,
    status: caseB.status,
    guardrail_state: caseB.guardrail_state,
    razorpay_refund_id: caseB.razorpay_refund_id,
    recommended_refund_paise: caseB.recommended_refund_paise,
    human_approved_by: caseB.human_approved_by,
    human_approved_at: caseB.human_approved_at,
  });

  if (caseB.status === 'REFUNDED' && caseB.razorpay_refund_id && caseB.human_approved_by) {
    console.log('\n>>> ALL LIVE SIMULATION TESTS PASSED! <<<');
  } else {
    console.error('\n>>> LIVE SIMULATION FAILED <<<');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
