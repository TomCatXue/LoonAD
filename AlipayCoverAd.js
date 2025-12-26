/***********************************
> 应用名称：支付宝封面广告屏蔽
> 脚本功能：屏蔽首页/开屏封面广告
> 作者：TomCatXue
> 特别说明：本脚本仅供学习交流使用

[rewrite_local]
# 支付宝封面广告屏蔽

[mitm]
hostname = cover.alipay.com, amdc.alipay.com
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
const adType = args.type || 'cover';
const enableLogging = args.logging === 'true';
const responseMode = args.mode || 'reject';

// ============================================
// 封面广告类型映射
// ============================================
const COVER_TYPE_MAP = {
    'cover': '封面广告',
    'splash': '开屏广告',
    'default': '封面广告'
};

// ============================================
// 日志函数
// ============================================
function log(message, level = 'INFO') {
    if (enableLogging) {
        const timestamp = new Date().toLocaleTimeString();
        const typeName = COVER_TYPE_MAP[adType] || adType;
        const logLevel = level === 'ERROR' ? '🔴' : level === 'WARN' ? '🟡' : '🔵';
        console.log(`[${timestamp}] ${logLevel} [封面广告-${typeName}] ${message}`);
    }
}

// ============================================
// 生成空封面广告响应
// ============================================
function generateEmptyCoverResponse() {
    return {
        success: true,
        code: "10000",
        msg: "Success",
        data: {
            coverUrl: "",
            duration: 0,
            skipEnabled: true,
            skipSeconds: 1,
            actionUrl: "",
            showTimes: 0,
            maxShowTimes: 0,
            startTime: 0,
            endTime: 0,
            isAvailable: false,
            adId: ""
        },
        result: {
            hasCover: false,
            lastShowTime: 0,
            nextAvailableTime: Date.now() + 86400000 // 24小时后
        }
    };
}

// ============================================
// 生成跳过封面广告的响应
// ============================================
function generateSkipCoverResponse() {
    return {
        success: true,
        code: "SKIP_COVER",
        msg: "跳过封面广告",
        data: {
            coverUrl: "",
            duration: 0,
            skipEnabled: true,
            skipSeconds: 0,  // 立即跳过
            actionUrl: "",
            showTimes: 999,  // 已显示很多次
            maxShowTimes: 1,  // 最大显示1次
            startTime: Date.now() - 86400000, // 昨天开始
            endTime: Date.now() - 43200000,   // 半天前结束
            isAvailable: false,
            adId: "SKIPPED_AD"
        },
        result: {
            hasCover: false,
            lastShowTime: Date.now(),
            nextAvailableTime: Date.now() + 2592000000 // 30天后
        }
    };
}

// ============================================
// 清理封面广告数据
// ============================================
function cleanCoverData(originalData) {
    if (!originalData || typeof originalData !== 'object') {
        return generateEmptyCoverResponse();
    }
    
    const cleaned = { ...originalData };
    
    // 确保封面广告不可用
    if (cleaned.data) {
        cleaned.data.coverUrl = "";
        cleaned.data.duration = 0;
        cleaned.data.skipEnabled = true;
        cleaned.data.skipSeconds = 0;
        cleaned.data.isAvailable = false;
        cleaned.data.showTimes = 999;
        cleaned.data.maxShowTimes = 1;
        
        // 设置过期时间
        const now = Date.now();
        cleaned.data.startTime = now - 86400000;
        cleaned.data.endTime = now - 43200000;
    }
    
    if (cleaned.result) {
        cleaned.result.hasCover = false;
        cleaned.result.nextAvailableTime = now + 2592000000; // 30天后
    }
    
    // 设置成功状态
    cleaned.success = true;
    cleaned.code = "NO_COVER_AD";
    cleaned.msg = "暂无封面广告";
    
    return cleaned;
}

// ============================================
// 生成屏蔽响应
// ============================================
function generateBlockResponse() {
    log(`使用响应模式: ${responseMode}`, 'INFO');
    
    switch(responseMode) {
        case 'empty':
            // 返回空封面广告
            return {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-store'  // 不缓存，每次重新检查
                },
                body: JSON.stringify(generateEmptyCoverResponse())
            };
            
        case 'modify':
            // 修改响应，让封面广告立即跳过
            try {
                if (typeof $response !== 'undefined' && $response.body) {
                    let originalData;
                    try {
                        originalData = JSON.parse($response.body);
                    } catch(e) {
                        log(`JSON解析失败: ${e}`, 'ERROR');
                        // 返回跳过响应
                        return {
                            status: 200,
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify(generateSkipCoverResponse())
                        };
                    }
                    
                    // 清理封面广告数据
                    const cleanedData = cleanCoverData(originalData);
                    
                    return {
                        status: 200,
                        headers: $response.headers,
                        body: JSON.stringify(cleanedData)
                    };
                }
            } catch(error) {
                log(`修改响应失败: ${error}`, 'ERROR');
            }
            // 修改失败时返回跳过响应
            return {
                status: 200,
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(generateSkipCoverResponse())
            };
            
        case 'reject':
        default:
            // 直接拒绝封面广告
            return {
                status: 403,
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    success: false,
                    code: "COVER_AD_BLOCKED",
                    msg: "封面广告已被屏蔽",
                    subCode: "COVER_FILTERED",
                    subMsg: "跳过封面显示"
                })
            };
    }
}

// ============================================
// 主处理函数
// ============================================
function main() {
    const typeName = COVER_TYPE_MAP[adType] || adType;
    log(`开始处理: ${typeName}`, 'INFO');
    
    if (typeof $request !== 'undefined') {
        log(`请求URL: ${$request.url}`, 'INFO');
        log(`请求方法: ${$request.method}`, 'INFO');
    }
    
    // 记录屏蔽统计
    try {
        const statsKey = `CoverAd_${adType}_BlockCount`;
        const count = parseInt($persistentStore.read(statsKey) || '0');
        $persistentStore.write((count + 1).toString(), statsKey);
        $persistentStore.write(new Date().toISOString(), `CoverAd_${adType}_LastBlock`);
        log(`屏蔽次数: ${count + 1}`, 'INFO');
        
        // 记录总封面广告屏蔽次数
        const totalKey = 'CoverAd_TotalSkipCount';
        const totalCount = parseInt($persistentStore.read(totalKey) || '0');
        $persistentStore.write((totalCount + 1).toString(), totalKey);
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
    
    // 错误时返回跳过响应
    $done({
        status: 200,
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(generateSkipCoverResponse())
    });
}

// ============================================
// 导出函数
// ============================================
if (typeof module !== 'undefined') {
    module.exports = {
        parseArgs,
        generateEmptyCoverResponse,
        generateSkipCoverResponse,
        cleanCoverData,
        COVER_TYPE_MAP
    };
}
