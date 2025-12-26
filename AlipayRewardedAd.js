/***********************************
> 应用名称：支付宝激励广告屏蔽
> 脚本功能：屏蔽激励视频广告和商品信息流广告
> 作者：TomCatXue
> 特别说明：本脚本仅供学习交流使用

[rewrite_local]
# 支付宝激励广告屏蔽

[mitm]
hostname = reward.alipay.com, productfeed.alipay.com, incentive.alipay.com
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
const adType = args.type || 'rewarded';
const enableLogging = args.logging === 'true';
const responseMode = args.mode || 'reject';

// ============================================
// 激励广告类型映射
// ============================================
const REWARDED_TYPE_MAP = {
    'rewarded': '激励视频广告',
    'productfeed': '商品信息流广告',
    'incentive': '激励广告配置',
    'default': '激励广告'
};

// ============================================
// 日志函数
// ============================================
function log(message, level = 'INFO') {
    if (enableLogging) {
        const timestamp = new Date().toLocaleTimeString();
        const typeName = REWARDED_TYPE_MAP[adType] || adType;
        const logLevel = level === 'ERROR' ? '🔴' : level === 'WARN' ? '🟡' : '🔵';
        console.log(`[${timestamp}] ${logLevel} [激励广告-${typeName}] ${message}`);
    }
}

// ============================================
// 生成空激励广告响应
// ============================================
function generateEmptyRewardedResponse() {
    const emptyResponses = {
        'rewarded': {
            success: true,
            code: "10000",
            msg: "Success",
            data: {
                videoUrl: "",
                duration: 0,
                rewardAmount: 0,
                rewardName: "",
                adId: "",
                creativeId: "",
                isAvailable: false,
                isEnded: true
            }
        },
        'productfeed': {
            success: true,
            code: "10000",
            msg: "Success",
            data: {
                feedList: [],
                total: 0,
                hasMore: false,
                refreshInterval: 0
            }
        },
        'incentive': {
            success: true,
            code: "10000",
            msg: "Success",
            data: {
                config: {},
                rules: [],
                rewards: [],
                isEnabled: false
            }
        },
        'default': {
            success: true,
            code: "NO_REWARDED_AD",
            msg: "暂无激励广告",
            data: null
        }
    };
    
    return emptyResponses[adType] || emptyResponses.default;
}

// ============================================
// 生成假的视频广告数据（用于迷惑组件）
// ============================================
function generateFakeVideoAd() {
    return {
        success: true,
        code: "10000",
        msg: "Success",
        data: {
            videoUrl: "about:blank",
            duration: 1,  // 1秒假视频
            rewardAmount: 0,
            rewardName: "无奖励",
            adId: "FAKE_AD_" + Date.now(),
            creativeId: "FAKE_CREATIVE",
            isAvailable: false,  // 不可用
            isEnded: true,       // 已结束
            advertiser: "",
            title: "广告加载失败",
            description: "暂时没有可用的广告",
            clickUrl: "",
            impressionUrl: "",
            startUrl: "",
            completeUrl: "",
            closeUrl: "",
            errorUrl: ""
        }
    };
}

// ============================================
// 生成假的商品信息流数据
// ============================================
function generateFakeProductFeed() {
    const fakeProducts = [
        {
            productId: "FAKE_001",
            title: "暂无商品",
            price: "0.00",
            originalPrice: "0.00",
            imageUrl: "",
            shopName: "",
            sales: 0,
            rating: 0,
            adInfo: {
                adId: "",
                isAd: false
            }
        }
    ];
    
    return {
        success: true,
        code: "10000",
        msg: "Success",
        data: {
            feedList: fakeProducts,
            total: 0,
            hasMore: false,
            refreshInterval: 3600,  // 1小时后刷新
            timestamp: Date.now()
        }
    };
}

// ============================================
// 清理激励广告数据
// ============================================
function cleanRewardedData(originalData) {
    if (!originalData || typeof originalData !== 'object') {
        return generateEmptyRewardedResponse();
    }
    
    const cleaned = { ...originalData };
    
    // 通用清理
    cleaned.success = true;
    cleaned.code = "NO_AD_AVAILABLE";
    cleaned.msg = "暂无广告资源";
    
    // 根据广告类型进行特定清理
    if (adType === 'rewarded' && cleaned.data) {
        cleaned.data.videoUrl = "";
        cleaned.data.duration = 0;
        cleaned.data.isAvailable = false;
        cleaned.data.isEnded = true;
        cleaned.data.rewardAmount = 0;
    } else if (adType === 'productfeed' && cleaned.data) {
        if (cleaned.data.feedList && Array.isArray(cleaned.data.feedList)) {
            // 过滤掉广告商品
            cleaned.data.feedList = cleaned.data.feedList.filter(item => {
                return !item || !item.adInfo || !item.adInfo.isAd;
            });
            if (cleaned.data.feedList.length === 0) {
                cleaned.data.feedList = [];
            }
        }
        cleaned.data.hasMore = false;
        cleaned.data.total = 0;
    }
    
    return cleaned;
}

// ============================================
// 检查是否是视频广告请求
// ============================================
function isVideoAdRequest(url) {
    const videoPatterns = [
        '/video/', '/reward/', '/incentive/video',
        '.mp4', '.m3u8', '.flv', '.avi'
    ];
    
    const lowerUrl = url.toLowerCase();
    return videoPatterns.some(pattern => lowerUrl.includes(pattern));
}

// ============================================
// 生成屏蔽响应
// ============================================
function generateBlockResponse() {
    log(`使用响应模式: ${responseMode}`, 'INFO');
    
    // 如果是视频文件请求，直接返回404
    if (typeof $request !== 'undefined' && isVideoAdRequest($request.url)) {
        log(`拦截视频广告请求: ${$request.url}`, 'WARN');
        return {
            status: 404,
            headers: {'Content-Type': 'text/plain'},
            body: 'Video ad blocked'
        };
    }
    
    switch(responseMode) {
        case 'empty':
            // 返回空数据
            return {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'max-age=600'
                },
                body: JSON.stringify(generateEmptyRewardedResponse())
            };
            
        case 'modify':
            // 修改响应数据
            try {
                if (typeof $response !== 'undefined' && $response.body) {
                    let originalData;
                    try {
                        originalData = JSON.parse($response.body);
                    } catch(e) {
                        log(`JSON解析失败: ${e}`, 'ERROR');
                        // 根据广告类型返回不同的假数据
                        if (adType === 'rewarded') {
                            return {
                                status: 200,
                                headers: {'Content-Type': 'application/json'},
                                body: JSON.stringify(generateFakeVideoAd())
                            };
                        } else if (adType === 'productfeed') {
                            return {
                                status: 200,
                                headers: {'Content-Type': 'application/json'},
                                body: JSON.stringify(generateFakeProductFeed())
                            };
                        }
                        return {
                            status: 200,
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify(generateEmptyRewardedResponse())
                        };
                    }
                    
                    // 清理广告数据
                    const cleanedData = cleanRewardedData(originalData);
                    
                    return {
                        status: 200,
                        headers: $response.headers,
                        body: JSON.stringify(cleanedData)
                    };
                }
            } catch(error) {
                log(`修改响应失败: ${error}`, 'ERROR');
            }
            // 修改失败时返回空数据
            return {
                status: 200,
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(generateEmptyRewardedResponse())
            };
            
        case 'reject':
        default:
            // 直接拒绝
            return {
                status: 403,
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    success: false,
                    code: "REWARDED_AD_BLOCKED",
                    msg: "激励广告已被屏蔽",
                    subCode: "AD_BLOCKED",
                    subMsg: REWARDED_TYPE_MAP[adType] || "激励广告"
                })
            };
    }
}

// ============================================
// 主处理函数
// ============================================
function main() {
    const typeName = REWARDED_TYPE_MAP[adType] || adType;
    log(`开始处理: ${typeName}`, 'INFO');
    
    if (typeof $request !== 'undefined') {
        log(`请求URL: ${$request.url}`, 'INFO');
    }
    
    // 记录屏蔽统计
    try {
        const statsKey = `RewardedAd_${adType}_BlockCount`;
        const count = parseInt($persistentStore.read(statsKey) || '0');
        $persistentStore.write((count + 1).toString(), statsKey);
        $persistentStore.write(new Date().toISOString(), `RewardedAd_${adType}_LastBlock`);
        log(`屏蔽次数: ${count + 1}`, 'INFO');
        
        // 记录视频广告屏蔽
        if (isVideoAdRequest($request?.url || '')) {
            const videoKey = 'RewardedAd_VideoBlockCount';
            const videoCount = parseInt($persistentStore.read(videoKey) || '0');
            $persistentStore.write((videoCount + 1).toString(), videoKey);
        }
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
    
    // 错误时返回空数据
    $done({
        status: 200,
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(generateEmptyRewardedResponse())
    });
}

// ============================================
// 导出函数
// ============================================
if (typeof module !== 'undefined') {
    module.exports = {
        parseArgs,
        generateEmptyRewardedResponse,
        generateFakeVideoAd,
        generateFakeProductFeed,
        cleanRewardedData,
        isVideoAdRequest,
        REWARDED_TYPE_MAP
    };
}
