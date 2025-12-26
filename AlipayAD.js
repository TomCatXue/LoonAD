/*
 * Alipay MiniProgram AdBlock - Stable
 */

function parseArgs(str) {
  const obj = {};
  if (!str) return obj;
  str.split('&').forEach(pair => {
    const [k, v] = pair.split('=');
    if (k) obj[k] = v;
  });
  return obj;
}

const args = parseArgs($argument);

const blockSplash = args.block_splash === 'true';
const blockInterstitial = args.block_interstitial === 'true';
const blockFeed = args.block_feed === 'true';
const blockTask = args.block_task === 'true';
const blockReward = args.block_reward === 'true';

const AD_KEYS = [
  'tanx',
  'alimama',
  'adInfo',
  'adList',
  'marketing',
  'recommendAd',
  'taskAd'
];

function looksLikeAdPayload(obj) {
  if (!obj || typeof obj !== 'object') return false;
  return Object.keys(obj).some(k =>
    AD_KEYS.some(a => k.toLowerCase().includes(a))
  );
}

function deepClean(obj) {
  if (Array.isArray(obj)) {
    return obj.filter(i => !looksLikeAdPayload(i)).map(deepClean);
  }
  if (obj && typeof obj === 'object') {
    for (const k in obj) {
      if (looksLikeAdPayload(obj[k])) {
        delete obj[k];
      } else {
        obj[k] = deepClean(obj[k]);
      }
    }
  }
  return obj;
}

try {
  const ct = $response.headers['Content-Type'] || '';
  if (!ct.includes('application/json')) {
    $done({});
    return;
  }

  let body = JSON.parse($response.body);

  // —— 开屏 / 插屏：直接清空
  if ((blockSplash || blockInterstitial) && looksLikeAdPayload(body)) {
    $done({ body: '{}' });
    return;
  }

  // —— 信息流 / 任务广告
  if (blockFeed || blockTask) {
    body = deepClean(body);
  }

  $done({ body: JSON.stringify(body) });

} catch (e) {
  $done({});
}
