/***********************************
> 应用名称：支付宝广告API屏蔽
> 脚本功能：屏蔽支付宝广告数据API，支持深度清理
> 作者：TomCatXue
> 特别说明：本脚本仅供学习交流使用

[rewrite_local]
# 支付宝广告API屏蔽

[mitm]
hostname = openapi.alipay.com, mapi.alipay.com, *.alipay.com
***********************************/

// ============================================
// 参数解析
// ============================================
function parseArgs() {
    const args = {};
    if (typeof $argument !== 'undefined') {
        $argument.split('&').forEach(pair => {
            const [key, value] = pair.split('=');
            if (key && value !== undefined) args[key] = value;
        });
    }
    return args;
}

const args = parseArgs();
const adType = args.type || 'default';
const enableLogging = args.logging === 'true';
const responseMode = args.mode || 'reject';
const deepCleanMode = args.deep === 'true';

// ============================================
// 广告类型映射
// ============================================
const AD_TYPE_MAP = {
    'agentreport': '广告代理商投放数据查询',
    'reportdata': '广告投放数据通用查询',
    'reportmetric': '广告商家指标查询',
    'promotepage': '自建推广页相关',
    'default': '通用广告API'
};

// ============================================
// 广告关键词识别
// ============================================
const AD_KEYWORDS = [
    'ad', 'ads', 'advert', 'promotion', 'marketing',
    'tanx', 'alimama', 'reward', 'incentive',
    'banner', 'popup', 'splash', 'interstitial',
    'feed', 'task', 'recommend', 'sponsor'
];

// ============================================
// 日志函数
// ============================================
function log(message, level = 'INFO') {
    if (enableLogging) {
        const timestamp = new Date().toLocaleTimeString();
        const typeName = AD_TYPE_MAP[adType] || adType;
        const logLevel = level === 'ERROR' ? '🔴' : level === 'WARN' ? '🟡' : '🔵';
        console.log(`[${timestamp}] ${logLevel} [支付宝广告API-${typeName}] ${message}`);
    }
}

// ============================================
// 深度清理广告数据
// ============================================
function deepCleanAdData(obj, path = '') {
    if (!obj || typeof obj !== 'object') {
        return obj;
    }
    
    // 如果是数组，递归清理每个元素
    if (Array.isArray(obj)) {
        const cleanedArray = [];
        for (let i = 0; i < obj.length; i++) {
            const cleaned = deepCleanAdData(obj[i], `${path}[${i}]`);
            if (cleaned !== null) {
                cleanedArray.push(cleaned);
            }
        }
        return cleanedArray;
    }
    
    // 如果是对象，检查并清理广告相关字段
    const cleanedObj = {};
    let hasAdFields = false;
    
    for (const key in obj) {
        const currentPath = path ? `${path}.${key}` : key;
        const lowerKey = key.toLowerCase();
        
        // 检查是否是广告字段
        let isAdField = false;
        for (const adKeyword of AD_KEYWORDS) {
            if (lowerKey.includes(adKeyword)) {
                log(`移除广告字段: ${currentPath}`, 'INFO');
                isAdField = true;
                hasAdFields = true;
                break;
            }
        }
        
        // 如果不是广告字段，递归清理
        if (!isAdField) {
            const cleanedValue = deepCleanAdData(obj[key], currentPath);
            if (cleanedValue !== null) {
                cleanedObj[key] = cleanedValue;
            }
        }
    }
    
    // 如果对象完全被清理，返回空对象
    if (Object.keys(cleanedObj).length === 0 && hasAdFields) {
        return {};
    }
    
    return cleanedObj;
}

// ============================================
// 生成空广告响应
// ============================================
function generateEmptyAdResponse() {
    const emptyResponses = {
        'agentreport': {
            success: true,
            code: "10000",
            msg: "Success",
            data: {
                agentReportList: [],
                totalCount: 0,
                pageSize: 10,
                currentPage: 1,
                totalPage: 0
            }
        },
        'reportdata': {
            success: true,
            code: "10000",
            msg: "Success",
            data: {
                reportDataList: [],
                summary: {},
                metrics: []
            }
        },
        'reportmetric': {
            success: true,
            code: "10000",
            msg: "Success",
            data: {
                metrics: [],
                dimensions: [],
                values: []
            }
        },
        'promotepage': {
            success: true,
            code: "10000",
            msg: "Success",
            data: {
                pageList: [],
                totalCount: 0,
                downloadData: null
            }
        },
        'default': {
            success: true,
            code: "10000",
            msg: "Success",
            data: null,
            result: {}
        }
    };
    
    return emptyResponses[adType] || emptyResponses.default;
}

// ============================================
// 生成屏蔽响应
// ============================================
function generateBlockResponse() {
    log(`使用响应模式: ${responseMode}, 深度清理: ${deepCleanMode}`, 'INFO');
    
    switch(responseMode) {
        case 'empty':
            // 返回空数据
            return {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'max-age=3600'
                },
                body: JSON.stringify(generateEmptyAdResponse())
            };
            
        case 'modify':
            // 尝试修改原始响应
            try {
                if (typeof $response !== 'undefined' && $response.body) {
                    let body;
                    try {
                        body = JSON.parse($response.body);
                    } catch(e) {
                        log(`JSON解析失败: ${e}`, 'ERROR');
                        return {
                            status: 200,
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify(generateEmptyAdResponse())
                        };
                    }
                    
                    // 深度清理模式
                    if (deepCleanMode) {
                        log('启用深度清理模式', 'INFO');
                        body = deepCleanAdData(body);
                    } else {
                        // 简单清理：只清空data字段
                        if (body.data) {
                            body.data = null;
                        }
                        if (body.result) {
                            body.result = {};
                        }
                    }
                    
                    // 确保返回成功状态
                    body.success = true;
                    body.code = body.code || "10000";
                    body.msg = body.msg || "Success";
                    
                    return {
                        status: 200,
                        headers: $response.headers,
                        body: JSON.stringify(body)
                    };
                }
            } catch(error) {
                log(`修改响应失败: ${error}`, 'ERROR');
            }
            // 如果修改失败，返回空数据
            return {
                status: 200,
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(generateEmptyAdResponse())
            };
            
        case 'reject':
        default:
            // 直接拒绝
            return {
                status: 403,
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    success: false,
                    code: "AD_API_BLOCKED",
                    msg: "广告API请求已被屏蔽",
                    subCode: "ACCESS_DENIED",
                    subMsg: AD_TYPE_MAP[adType] || "广告数据查询"
                })
            };
    }
}

// ============================================
// 主处理函数
// ============================================
function main() {
    const typeName = AD_TYPE_MAP[adType] || adType;
    log(`开始处理: ${typeName}`, 'INFO');
    
    if (typeof $request !== 'undefined') {
        log(`请求URL: ${$request.url}`, 'INFO');
        log(`请求方法: ${$request.method}`, 'INFO');
    }
    
    // 记录屏蔽统计
    try {
        const statsKey = `AlipayAdAPI_${adType}_BlockCount`;
        const count = parseInt($persistentStore.read(statsKey) || '0');
        $persistentStore.write((count + 1).toString(), statsKey);
        $persistentStore.write(new Date().toISOString(), `AlipayAdAPI_${adType}_LastBlock`);
        log(`屏蔽次数: ${count + 1}`, 'INFO');
    } catch(e) {
        log(`统计记录失败: ${e}`, 'ERROR');
    }
    
    // 处理响应
    const response = generateBlockResponse();
    $done(response);
}

// ============================================
// 错误处理
// ============================================
try {
    main();
} catch(error) {
    log(`脚本执行错误: ${error}`, 'ERROR');
    log(`错误堆栈: ${error.stack}`, 'ERROR');
    
    // 错误时返回空数据
    $done({
        status: 200,
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            success: true,
            code: "ERROR",
            msg: "处理异常",
            data: null
        })
    });
}

// ============================================
// 导出函数（供其他脚本调用）
// ============================================
if (typeof module !== 'undefined') {
    module.exports = {
        parseArgs,
        deepCleanAdData,
        generateEmptyAdResponse,
        generateBlockResponse,
        log,
        AD_KEYWORDS,
        AD_TYPE_MAP
    };
}
