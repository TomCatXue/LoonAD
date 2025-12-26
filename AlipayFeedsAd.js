/***********************************
> 应用名称：支付宝信息流广告屏蔽
> 脚本功能：屏蔽信息流广告组件
> 作者：TomCatXue
> 特别说明：本脚本仅供学习交流使用

[rewrite_local]
# 支付宝信息流广告屏蔽

[mitm]
hostname = feeds.alipay.com, mss.alipay.com
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
const adType = args.type || 'feeds';
const enableLogging = args.logging === 'true';
const responseMode = args.mode || 'reject';

// ============================================
// 信息流广告类型映射
// ============================================
const FEEDS_TYPE_MAP = {
    'feeds': '信息流广告',
    'mss': '信息流服务',
    'default': '信息流广告'
};

// ============================================
// 日志函数
// ============================================
function log(message, level = 'INFO') {
    if (enableLogging) {
        const timestamp = new Date().toLocaleTimeString();
        const typeName = FEEDS_TYPE_MAP[adType] || adType;
        const logLevel = level === 'ERROR' ? '🔴' : level === 'WARN' ? '🟡' : '🔵';
        console.log(`[${timestamp}] ${logLevel} [信息流广告-${typeName}] ${message}`);
    }
}

// ============================================
// 生成空信息流响应
// ============================================
function generateEmptyFeedsResponse() {
    return {
        success: true,
        code: "10000",
        msg: "Success",
        data: {
            feeds: [],
            total: 0,
            pageSize: 10,
            currentPage: 1,
            totalPages: 0,
            hasMore: false,
            adPositions: [],
            refreshTime: Date.now()
        },
        result: {
            list: [],
            adCount: 0,
            contentCount: 0
        }
    };
}

// ============================================
// 生成假的内容数据（替换广告）
// ============================================
function generateFakeContentFeeds() {
    const fakeContents = [
        {
            id: "CONTENT_001",
            type: "article",
            title: "支付宝使用技巧",
            summary: "了解支付宝的最新功能和使用方法",
            coverImage: "",
            publishTime: Date.now() - 86400000,
            author: "支付宝官方",
            viewCount: 1000,
            likeCount: 50,
            isAd: false,
            adInfo: null
        },
        {
            id: "CONTENT_002", 
            type: "news",
            title: "数字生活服务",
            summary: "探索数字化生活的便利",
            coverImage: "",
            publishTime: Date.now() - 172800000,
            author: "生活服务",
            viewCount: 800,
            likeCount: 30,
            isAd: false,
            adInfo: null
        }
    ];
    
    return {
        success: true,
        code: "10000",
        msg: "Success",
        data: {
            feeds: fakeContents,
            total: fakeContents.length,
            pageSize: 10,
            currentPage: 1,
            totalPages: 1,
            hasMore: false,
            adPositions: [],
            refreshTime: Date.now()
        },
        result: {
            list: fakeContents,
            adCount: 0,
            contentCount: fakeContents.length
        }
    };
}

// ============================================
// 检测和清理广告内容
// ============================================
function detectAndCleanAds(data) {
    if (!data || typeof data !== 'object') {
        return generateEmptyFeedsResponse();
    }
    
    const cleaned = JSON.parse(JSON.stringify(data));
    
    // 检测广告的字段
    const adIndicators = [
        'ad', 'ads', 'advert', 'sponsor', 'promotion',
        'tanx', 'alimama', 'adId', 'adInfo', 'isAd',
        'advertiser', 'adPosition', 'adType'
    ];
    
    function isAdItem(item) {
        if (!item || typeof item !== 'object') return false;
        
        // 检查字段名
        for (const key in item) {
            const lowerKey = key.toLowerCase();
            for (const indicator of adIndicators) {
                if (lowerKey.includes(indicator.toLowerCase())) {
                    return true;
                }
            }
        }
        
        // 检查字段值
        const itemStr = JSON.stringify(item).toLowerCase();
        for (const indicator of adIndicators) {
            if (itemStr.includes(indicator.toLowerCase())) {
                return true;
            }
        }
        
        return false;
    }
    
    // 清理feeds列表
    if (cleaned.data && cleaned.data.feeds && Array.isArray(cleaned.data.feeds)) {
        const originalCount = cleaned.data.feeds.length;
        cleaned.data.feeds = cleaned.data.feeds.filter(item => !isAdItem(item));
        const adCount = originalCount - cleaned.data.feeds.length;
        
        if (adCount > 0) {
            log(`清理了 ${adCount} 个信息流广告`, 'INFO');
        }
        
        // 更新统计数据
        cleaned.data.total = cleaned.data.feeds.length;
        cleaned.data.hasMore = false;
    }
    
    // 清理result列表
    if (cleaned.result && cleaned.result.list && Array.isArray(cleaned.result.list)) {
        cleaned.result.list = cleaned.result.list.filter(item => !isAdItem(item));
        cleaned.result.adCount = 0;
        cleaned.result.contentCount = cleaned.result.list.length;
    }
    
    // 确保返回成功状态
    cleaned.success = true;
    cleaned.code = cleaned.code || "10000";
    cleaned.msg = cleaned.msg || "Success";
    
    return cleaned;
}

// ============================================
// 生成屏蔽响应
// ============================================
function generateBlockResponse() {
    log(`使用响应模式: ${responseMode}`, 'INFO');
    
    switch(responseMode) {
        case 'empty':
            // 返回空信息流
            return {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'max-age=300'
                },
                body: JSON.stringify(generateEmptyFeedsResponse())
            };
            
        case 'modify':
            // 修改响应，清理广告内容
            try {
                if (typeof $response !== 'undefined' && $response.body) {
                    let originalData;
                    try {
                        originalData = JSON.parse($response.body);
                    } catch(e) {
                        log(`JSON解析失败: ${e}`, 'ERROR');
                        // 返回假的内容数据
                        return {
                            status: 200,
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify(generateFakeContentFeeds())
                        };
                    }
                    
                    // 检测和清理广告
                    const cleanedData = detectAndCleanAds(originalData);
                    
                    // 如果清理后没有内容，用假内容填充
                    if ((!cleanedData.data.feeds || cleanedData.data.feeds.length === 0) && 
                        (!cleanedData.result.list || cleanedData.result.list.length === 0)) {
                        log('清理后没有内容，使用假内容填充', 'INFO');
                        return {
                            status: 200,
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify(generateFakeContentFeeds())
                        };
                    }
                    
                    return {
                        status: 200,
                        headers: $response.headers,
                        body: JSON.stringify(cleanedData)
                    };
                }
            } catch(error) {
                log(`修改响应失败: ${error}`, 'ERROR');
            }
            // 修改失败时返回空信息流
            return {
                status: 200,
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(generateEmptyFeedsResponse())
            };
            
        case 'reject':
        default:
            // 直接拒绝
            return {
                status: 403,
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    success: false,
                    code: "FEEDS_AD_BLOCKED",
                    msg: "信息流广告已被屏蔽",
                    subCode: "AD_FILTERED",
                    subMsg: "广告内容已被过滤"
                })
            };
    }
}

// ============================================
// 主处理函数
// ============================================
function main() {
    const typeName = FEEDS_TYPE_MAP[adType] || adType;
    log(`开始处理: ${typeName}`, 'INFO');
    
    if (typeof $request !== 'undefined') {
        log(`请求URL: ${$request.url}`, 'INFO');
        log(`请求方法: ${$request.method}`, 'INFO');
    }
    
    // 记录屏蔽统计
    try {
        const statsKey = `FeedsAd_${adType}_BlockCount`;
        const count = parseInt($persistentStore.read(statsKey) || '0');
        $persistentStore.write((count + 1).toString(), statsKey);
        $persistentStore.write(new Date().toISOString(), `FeedsAd_${adType}_LastBlock`);
        log(`屏蔽次数: ${count + 1}`, 'INFO');
    } catch(e) {
        log(`统计记录失败: ${e}`, 'ERROR');
    }
    
    // 处理请求/响应
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
    
    // 错误时返回空信息流
    $done({
        status: 200,
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(generateEmptyFeedsResponse())
    });
}

// ============================================
// 导出函数
// ============================================
if (typeof module !== 'undefined') {
    module.exports = {
        parseArgs,
        generateEmptyFeedsResponse,
        generateFakeContentFeeds,
        detectAndCleanAds,
        FEEDS_TYPE_MAP
    };
}
