/**
 * 支付宝广告综合屏蔽脚本 - 完整版
 * 包含：支付宝小程序、灯火平台、流量位插件、淘宝联盟、1688分销客
 * 图标：https://raw.githubusercontent.com/Orz-3/mini/master/Color/Alipay.png
 * 版本：2.0.0
 */

// ==================== 全局配置 ====================
const CONFIG = {
  // 流量位插件ID
  PLUGIN_IDS: ['2021001154677005', '2021001131694653'],
  
  // 广告域名列表
  AD_DOMAINS: [
    'ad.alipay.com', 'ads.alipay.com', 'advert.alipay.com',
    'admedia.alipay.com', 'adpub.alipay.com', 'dsp.alipay.com',
    'adx.alipay.com', 'ad.taobao.com', 'adash.taobao.com',
    'ad.1688.com', 'adsh.m.1688.com', 'alimama.com', 'tanx.com'
  ],
  
  // 灯火平台相关
  LARK_DOMAINS: ['admedia.alipay.com', 'adpub.alipay.com'],
  LARK_KEYWORDS: ['lark', 'adrlark', 'dio0wg', 'hexian.zy', 'wendy.gx', 'fiona.zm'],
  
  // 广告类型关键词
  AD_KEYWORDS: [
    // 流量位相关
    '流量位', 'resourceId', '插件', 'plugin', '小程序流量位',
    // 广告通用
    '广告', 'advert', 'advertisement', '推广', 'promotion',
    '变现', '佣金', 'commission', '分销', 'distribute',
    // 灯火平台
    '灯火', 'lark', '数字推广',
    // 淘宝联盟
    '淘宝联盟', '淘宝客', 'alimama', '联盟推广',
    // 1688
    '1688分销客', '批发推广', 'B2B广告'
  ],
  
  // 广告API路径
  AD_API_PATHS: [
    '/api/ad/', '/advert/', '/promotion/', '/distribute/',
    '/plugin/', '/miniapp/ad/', '/alipay/ad/', '/traffic/',
    '/lark/', '/adrlark/', '/guang.taobao'
  ],
  
  // 要屏蔽的特定小程序（可自定义添加）
  BLOCKED_MINI_PROGRAMS: {
    '2021001154677005': '流量位插件',
    '2021001131694653': '猜你喜欢插件'
  },
  
  // 调试模式
  DEBUG: false
};

// ==================== 工具函数 ====================
function log(...args) {
  if (CONFIG.DEBUG) {
    console.log(`[支付宝广告屏蔽]`, ...args);
  }
}

function containsAny(str, array) {
  if (!str) return false;
  const searchStr = typeof str === 'string' ? str : JSON.stringify(str);
  return array.some(item => searchStr.includes(item));
}

function matchAnyRegex(str, regexArray) {
  if (!str) return false;
  const searchStr = typeof str === 'string' ? str : JSON.stringify(str);
  return regexArray.some(regex => regex.test(searchStr));
}

// ==================== 请求分析函数 ====================
function analyzeRequest(request) {
  const { url, method, headers, body } = request;
  const result = {
    isAd: false,
    category: null,
    reason: '',
    details: {}
  };

  // 1. 域名检查
  for (const domain of CONFIG.AD_DOMAINS) {
    if (url.includes(domain)) {
      result.isAd = true;
      result.category = '广告域名';
      result.reason = `广告域名: ${domain}`;
      result.details.domain = domain;
      return result;
    }
  }

  // 2. 灯火平台检查
  for (const keyword of CONFIG.LARK_KEYWORDS) {
    if (url.includes(keyword) || (body && body.includes(keyword))) {
      result.isAd = true;
      result.category = '灯火平台';
      result.reason = `灯火平台关键词: ${keyword}`;
      result.details.platform = '灯火';
      return result;
    }
  }

  // 3. 流量位插件检查
  for (const pluginId of CONFIG.PLUGIN_IDS) {
    if (url.includes(pluginId) || (body && body.includes(pluginId))) {
      result.isAd = true;
      result.category = '流量位插件';
      result.reason = `流量位插件ID: ${pluginId}`;
      result.details.pluginId = pluginId;
      return result;
    }
  }

  // 4. 关键词检查
  for (const keyword of CONFIG.AD_KEYWORDS) {
    const checkStr = url + (body || '');
    if (checkStr.includes(keyword)) {
      result.isAd = true;
      result.category = '广告关键词';
      result.reason = `广告关键词: ${keyword}`;
      result.details.keyword = keyword;
      return result;
    }
  }

  // 5. API路径检查
  for (const apiPath of CONFIG.AD_API_PATHS) {
    if (url.includes(apiPath)) {
      result.isAd = true;
      result.category = '广告API';
      result.reason = `广告API路径: ${apiPath}`;
      result.details.apiPath = apiPath;
      return result;
    }
  }

  // 6. 特定小程序广告检查
  const referer = headers['Referer'] || headers['referer'] || '';
  if (referer.includes('miniapp')) {
    const appIdMatch = referer.match(/appId=([^&]+)/);
    if (appIdMatch) {
      const appId = appIdMatch[1];
      if (CONFIG.BLOCKED_MINI_PROGRAMS[appId]) {
        // 检查该小程序的请求是否包含广告
        const isAdRequest = containsAny(url, CONFIG.AD_KEYWORDS) || 
                           containsAny(body, CONFIG.AD_KEYWORDS);
        if (isAdRequest) {
          result.isAd = true;
          result.category = '特定小程序广告';
          result.reason = `屏蔽小程序: ${CONFIG.BLOCKED_MINI_PROGRAMS[appId]}`;
          result.details.appId = appId;
          result.details.appName = CONFIG.BLOCKED_MINI_PROGRAMS[appId];
          return result;
        }
      }
    }
  }

  return result;
}

// ==================== 广告数据处理函数 ====================
function createEmptyResponse(category) {
  const templates = {
    '广告域名': {
      code: 200,
      data: [],
      message: 'success',
      success: true
    },
    '灯火平台': {
      success: true,
      data: null,
      errorCode: null,
      errorMsg: null,
      traceId: `lark_blocked_${Date.now()}`
    },
    '流量位插件': {
      code: 0,
      data: {
        items: [],
        hasMore: false,
        total: 0
      },
      message: 'success',
      success: true
    },
    '淘宝联盟': {
      success: true,
      content: [],
      total: 0,
      hasNext: false,
      message: 'success'
    },
    '1688分销客': {
      success: true,
      data: {
        offers: [],
        totalCount: 0,
        pageSize: 10,
        currentPage: 1
      },
      errorCode: null,
      errorMessage: null
    },
    '特定小程序广告': {
      code: 403,
      message: '广告内容已被屏蔽',
      data: null,
      success: false
    },
    'default': {
      code: 200,
      data: [],
      message: 'success',
      success: true,
      timestamp: Date.now()
    }
  };

  return templates[category] || templates['default'];
}

function cleanAdResponse(body) {
  try {
    if (!body) return body;
    
    const data = typeof body === 'string' ? JSON.parse(body) : body;
    
    // 深度清理函数
    function deepClean(obj, depth = 0) {
      if (depth > 10) return obj; // 防止无限递归
      if (!obj || typeof obj !== 'object') return obj;
      
      if (Array.isArray(obj)) {
        // 过滤广告项
        return obj
          .filter(item => {
            if (!item || typeof item !== 'object') return true;
            const str = JSON.stringify(item);
            return !containsAny(str, CONFIG.AD_KEYWORDS);
          })
          .map(item => deepClean(item, depth + 1));
      }
      
      const cleaned = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          // 跳过广告相关字段
          const lowerKey = key.toLowerCase();
          if (lowerKey.includes('ad') || 
              lowerKey.includes('promotion') ||
              lowerKey.includes('distribute') ||
              key.includes('resourceId') ||
              key.includes('plugin') ||
              key.includes('commission')) {
            continue;
          }
          
          cleaned[key] = deepClean(obj[key], depth + 1);
        }
      }
      return cleaned;
    }
    
    return JSON.stringify(deepClean(data));
  } catch (error) {
    log('响应清理失败:', error);
    return body;
  }
}

// ==================== 主处理逻辑 ====================
// 判断是请求还是响应
const isRequest = typeof $request !== 'undefined';
const isResponse = typeof $response !== 'undefined';

if (isRequest) {
  // ========== HTTP请求拦截 ==========
  const analysis = analyzeRequest($request);
  
  if (analysis.isAd) {
    log(`🚫 屏蔽广告请求`);
    log(`类别: ${analysis.category}`);
    log(`原因: ${analysis.reason}`);
    log(`URL: ${$request.url}`);
    
    const emptyResponse = createEmptyResponse(analysis.category);
    
    $done({
      body: JSON.stringify(emptyResponse),
      headers: {
        ...$request.headers,
        'Content-Type': 'application/json'
      }
    });
  } else {
    $done({});
  }
  
} else if (isResponse) {
  // ========== HTTP响应拦截 ==========
  if (!$response.body) {
    $done({});
    return;
  }
  
  // 检查是否是广告响应
  const bodyStr = typeof $response.body === 'string' ? $response.body : JSON.stringify($response.body);
  const isAdResponse = containsAny(bodyStr, CONFIG.AD_KEYWORDS);
  
  if (isAdResponse) {
    log(`🛡️ 清理广告响应数据`);
    
    const cleanedBody = cleanAdResponse($response.body);
    
    $done({
      body: cleanedBody,
      headers: {
        ...$response.headers,
        'Content-Type': 'application/json',
        'Content-Length': String(cleanedBody.length)
      }
    });
  } else {
    $done({});
  }
  
} else {
  // ========== 定时任务或面板更新 ==========
  // 可以添加统计功能或面板更新逻辑
  $done({});
}

// ==================== 面板数据生成 ====================
if (typeof $argument !== 'undefined') {
  // 为Loon面板生成统计数据
  const stats = {
    title: "支付宝广告屏蔽",
    content: `已屏蔽广告请求\n流量位插件已禁用`,
    icon: "checkmark.shield.fill",
    "icon-color": "#00A3FF"
  };
  
  $done(stats);
}
