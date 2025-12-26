/***********************************
> 应用名称：支付宝开屏广告屏蔽
> 脚本功能：屏蔽开屏广告和插屏广告
> 作者：TomCatXue
> 特别说明：本脚本仅供学习交流使用

[rewrite_local]
# 支付宝开屏广告屏蔽

[mitm]
hostname = amdc.alipay.com, adash.m.taobao.com
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
const adType = args.type || 'splash';
const enableLogging = args.logging === 'true';
const responseMode = args.mode || 'reject';

// ============================================
// 开屏广告类型映射
// ============================================
const SPLASH_TYPE_MAP = {
    'splash': '开屏广告',
    'interstitial': '插屏广告',
    'default': '开屏广告'
};

// ============================================
// 日志函数
// ============================================
function log(message, level = 'INFO') {
    if (enableLogging) {
        const timestamp = new Date().toLocaleTimeString();
        const typeName = SPLASH_TYPE_MAP[adType] || adType;
        const logLevel = level === 'ERROR' ? '🔴' : level === 'WARN' ? '🟡' : '🔵';
        console.log(`[${timestamp}] ${logLevel} [开屏广告-${typeName}] ${message}`);
    }
}

// ============================================
// 生成空开屏广告响应
// ============================================
function generateEmptySplashResponse() {
    return {
        success: true,
        code: "10000",
        msg: "Success",
        data: {
            splashUrl: "",
            duration: 0,
            skipEnabled: true,
            skipSeconds: 0,
            actionUrl: "",
            showTimes: 0,
            maxShowTimes: 0,
            startTime: 0,
            endTime: 0,
            isAvailable: false,
            adId: "",
            adType: "none"
        },
        result: {
            hasSplash: false,
            lastShowTime: 0,
            showInterval: 3600000, // 1小时
            nextShowTime: Date.now() + 3600000
        }
    };
}

// ============================================
// 生成立即跳过的开屏广告
// ============================================
function generateSkipSplashResponse() {
    const now = Date.now();
    return {
        success: true,
        code: "SKIP_SPLASH",
        msg: "跳过开屏广告",
        data: {
            splashUrl: "",
            duration: 0.1,  // 0.1秒，几乎立即消失
            skipEnabled: true,
            skipSeconds: 0,  // 0秒后可跳过
            actionUrl: "",
            showTimes: 999,  // 已显示很多次
            maxShowTimes: 0,  // 不再显示
            startTime: now - 86400000,
            endTime: now - 43200000,
            isAvailable: false,
            adId: "SKIPPED_SPLASH",
            adType: "skipped"
        },
        result: {
            hasSplash: false,
            lastShowTime: now,
            showInterval: 2592000000, // 30天
            nextShowTime: now + 2592000000
        }
    };
}

// ============================================
// 清理开屏广告数据
// ============================================
function cleanSplashData(originalData) {
    if (!originalData || typeof originalData !== 'object') {
        return generateEmptySplashResponse();
    }
    
    const cleaned = { ...originalData };
    const now = Date.now();
    
    // 确保开屏广告不可用
    if (cleaned.data) {
        cleaned.data.splashUrl = "";
        cleaned.data.duration = 0.1;
        cleaned.data.skipEnabled = true;
        cleaned.data.skipSeconds = 0;
        cleaned.data.isAvailable = false;
        cleaned.data.showTimes = 999;
        cleaned.data.maxShowTimes = 0;
        cleaned.data.startTime = now - 86400000;
        cleaned.data.endTime = now - 43200000;
        cleaned.data.adType = "skipped";
    }
    
    if (cleaned.result) {
        cleaned.result.hasSplash = false;
        cleaned.result.lastShowTime = now;
        cleaned.result.showInterval = 2592000000;
        cleaned.result.nextShowTime = now + 2592000000;
    }
    
    // 设置成功状态
    cleaned.success = true;
    cleaned.code = "NO_SPLASH_AD";
    cleaned.msg = "跳过开屏广告";
    
    return cleaned;
}

// ============================================
// 生成屏蔽响应
// ============================================
function generateBlockResponse() {
    log(`使用响应模式: ${responseMode}`, 'INFO');
    
    switch(responseMode) {
        case 'empty':
            // 返回空开屏广告
            return {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache'
                },
                body: JSON.stringify(generateEmptySplashResponse())
            };
            
        case 'modify':
            // 修改响应，让开屏广告立即跳过
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
                            body: JSON.stringify(generateSkipSplashResponse())
                        };
                    }
                    
                    // 清理开屏广告数据
                    const cleanedData = cleanSplashData(originalData);
                    
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
                body: JSON.stringify(generateSkipSplashResponse())
            };
            
        case 'reject':
        default:
            // 直接拒绝
            return {
                status: 403,
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    success: false,
                    code: "SPLASH_AD_BLOCKED",
                    msg: "开屏广告已被屏蔽",
                    subCode: "AD_SKIPPED",
                    subMsg: "立即进入应用"
                })
            };
    }
}

// ============================================
// 主处理函数
// ============================================
function main() {
    const typeName = SPLASH_TYPE_MAP[adType] || adType;
    log(`开始处理: ${typeName}`, 'INFO');
    
    if (typeof $request !== 'undefined') {
        log(`请求URL: ${$request.url}`, 'INFO');
        log(`请求方法: ${$request.method}`, 'INFO');
        
        // 检测图片请求
        const url = $request.url.toLowerCase();
        if (url.includes('.jpg') || url.includes('.png') || url.includes('.gif') || url.includes('.webp')) {
            log(`检测到广告图片请求: ${url}`, 'WARN');
            // 对于图片请求，返回404
            $done({
                status: 404,
                headers: {'Content-Type': 'image/png'},
                body: ''
            });
            return;
        }
    }
    
    // 记录屏蔽统计
    try {
        const statsKey = `SplashAd_${adType}_BlockCount`;
        const count = parseInt($persistentStore.read(statsKey) || '0');
        $persistentStore.write((count + 1).toString(), statsKey);
        $persistentStore.write(new Date().toISOString(), `SplashAd_${adType}_LastBlock`);
        log(`屏蔽次数: ${count + 1}`, 'INFO');
        
        // 记录总开屏屏蔽次数
        const totalKey = 'SplashAd_TotalSkipCount';
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
        body: JSON.stringify(generateSkipSplashResponse())
    });
}

// ============================================
// 导出函数
// ============================================
if (typeof module !== 'undefined') {
    module.exports = {
        parseArgs,
        generateEmptySplashResponse,
        generateSkipSplashResponse,
        cleanSplashData,
        SPLASH_TYPE_MAP
    };
}
