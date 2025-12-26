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
