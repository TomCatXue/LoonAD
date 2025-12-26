/***********************************
> 应用名称：支付宝图文广告屏蔽
> 脚本功能：屏蔽图文广告组件
> 作者：TomCatXue
> 特别说明：本脚本仅供学习交流使用

[rewrite_local]
# 支付宝图文广告屏蔽

[mitm]
hostname = graphic.alipay.com, *.alipay.com
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
const adType = args.type || 'graphic';
const enableLogging = args.logging === 'true';
const responseMode = args.mode || 'reject';

// ============================================
// 图文广告类型映射
// ============================================
const GRAPHIC_TYPE_MAP = {
    'graphic': '图文广告',
    'banner': '横幅广告',
    'default': '图文广告'
};

// ============================================
// 日志函数
// ============================================
function log(message, level = 'INFO') {
    if (enableLogging) {
        const timestamp = new Date().toLocaleTimeString();
        const typeName = GRAPHIC_TYPE_MAP[adType] || adType;
        const logLevel = level === 'ERROR' ? '🔴' : level === 'WARN' ? '🟡' : '🔵';
        console.log(`[${timestamp}] ${logLevel} [图文广告-${typeName}] ${message}`);
    }
}

// ============================================
// 生成空图文广告响应
// ============================================
function generateEmptyGraphicResponse() {
    return {
        success: true,
        code: "10000",
        msg: "Success",
        data: {
            adList: [],
            total: 0,
            style: "none",
            position: "bottom",
            interval: 0,
            autoScroll: false,
            showClose: false,
            maxShowTimes: 0,
            currentShowTimes: 0
        },
        result: {
            hasAd: false,
            adHeight: 0,
            adWidth: 0
        }
    };
}

// ============================================
// 生成假的图文内容（非广告）
// ============================================
function generateFakeGraphicContent() {
    const fakeGraphics = [
        {
            id: "TIP_001",
            type: "tip",
            title: "使用提示",
            content: "支付宝为您提供便捷的服务",
            imageUrl: "",
            linkUrl: "",
            isAd: false,
            style: "info"
        },
        {
            id: "NOTICE_001",
            type: "notice",
            title: "系统通知",
            content: "系统运行正常",
            imageUrl: "",
            linkUrl: "",
            isAd: false,
            style: "normal"
        }
    ];
    
    return {
        success: true,
        code: "10000",
        msg: "Success",
        data: {
            adList: fakeGraphics,
            total: fakeGraphics.length,
            style: "simple",
            position: "hidden",  // 隐藏位置
            interval: 0,
            autoScroll: false,
            showClose: true,
            maxShowTimes: 1,
            currentShowTimes: 1
        },
        result: {
            hasAd: false,
            adHeight: 0,
            adWidth: 0,
            isFakeContent: true
        }
    };
}

// ============================================
// 检测图文广告
// ============================================
function isGraphicAd(item) {
    if (!item || typeof item !== 'object') return false;
    
    const adIndicators = [
        'ad', 'ads', 'advert', 'sponsor', 'promotion',
        'tanx', 'alimama', 'adId', 'adInfo',
        'clickUrl', 'impressionUrl', 'advertiser',
        'price', 'buy', 'shop', 'discount'
    ];
    
    // 检查字段
    for (const key in item) {
        const lowerKey = key.toLowerCase();
        for (const indicator of adIndicators) {
            if (lowerKey.includes(indicator.toLowerCase())) {
                return true;
            }
        }
    }
    
    // 检查内容
    const contentStr = JSON.stringify(item).toLowerCase();
    for (const indicator of adIndicators) {
        if (contentStr.includes(indicator.toLowerCase())) {
            return true;
        }
    }
    
    return false;
}

// ============================================
// 清理图文广告数据
// ============================================
function cleanGraphicData(originalData) {
    if (!originalData || typeof originalData !== 'object') {
        return generateEmptyGraphicResponse();
    }
    
    const cleaned = { ...originalData };
    
    // 清理广告列表
    if (cleaned.data && cleaned.data.adList && Array.isArray(cleaned.data.adList)) {
        const originalCount = cleaned.data.adList.length;
        cleaned.data.adList = cleaned.data.adList.filter(item => !isGraphicAd(item));
        const adCount = originalCount - cleaned.data.adList.length;
        
        if (adCount > 0) {
            log(`清理了 ${adCount} 个图文广告`, 'INFO');
        }
        
        // 如果没有内容了，用假内容填充
        if (cleaned.data.adList.length === 0) {
            log('没有非广告内容，使用提示内容填充', 'INFO');
            cleaned.data.adList = [
                {
                    id: "NO_AD_TIP",
                    type: "tip",
                    title: "暂无内容",
                    content: "当前没有需要显示的内容",
                    isAd: false
                }
            ];
        }
        
        cleaned.data.total = cleaned.data.adList.length;
        cleaned.data.style = "simple";
        cleaned.data.position = "hidden";
        cleaned.data.autoScroll = false;
        cleaned.data.showClose = true;
        cleaned.data.maxShowTimes = 1;
        cleaned.data.currentShowTimes = 1;
    }
    
    if (cleaned.result) {
        cleaned.result.hasAd = false;
        cleaned.result.adHeight = 0;
        cleaned.result.adWidth = 0;
    }
    
    // 设置成功状态
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
            // 返回空图文广告
            return {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'max-age=600'
                },
                body: JSON.stringify(generateEmptyGraphicResponse())
            };
            
        case 'modify':
            // 修改响应，清理广告
            try {
                if (typeof $response !== 'undefined' && $response.body) {
                    let originalData;
                    try {
                        originalData = JSON.parse($response.body);
                    } catch(e) {
                        log(`JSON解析失败: ${e}`, 'ERROR');
                        // 返回假内容
                        return {
                            status: 200,
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify(generateFakeGraphicContent())
                        };
                    }
                    
                    // 清理图文广告数据
                    const cleanedData = cleanGraphicData(originalData);
                    
                    return {
                        status: 200,
                        headers: $response.headers,
                        body: JSON.stringify(cleanedData)
                    };
                }
            } catch(error) {
                log(`修改响应失败: ${error}`, 'ERROR');
            }
            // 修改失败时返回空响应
            return {
                status: 200,
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(generateEmptyGraphicResponse())
            };
            
        case 'reject':
        default:
            // 直接拒绝
            return {
                status: 403,
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    success: false,
                    code: "GRAPHIC_AD_BLOCKED",
                    msg: "图文广告已被屏蔽",
                    subCode: "AD_FILTERED",
                    subMsg: "广告内容已移除"
                })
            };
    }
}

// ============================================
// 主处理函数
// ============================================
function main() {
    const typeName = GRAPHIC_TYPE_MAP[adType] || adType;
    log(`开始处理: ${typeName}`, 'INFO');
    
    if (typeof $request !== 'undefined') {
        log(`请求URL: ${$request.url}`, 'INFO');
        log(`请求方法: ${$request.method}`, 'INFO');
    }
    
    // 记录屏蔽统计
    try {
        const statsKey = `GraphicAd_${adType}_BlockCount`;
        const count = parseInt($persistentStore.read(statsKey) || '0');
        $persistentStore.write((count + 1).toString(), statsKey);
        $persistentStore.write(new Date().toISOString(), `GraphicAd_${adType}_LastBlock`);
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
    
    // 错误时返回空响应
    $done({
        status: 200,
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(generateEmptyGraphicResponse())
    });
}

// ============================================
// 导出函数
// ============================================
if (typeof module !== 'undefined') {
    module.exports = {
        parseArgs,
        generateEmptyGraphicResponse,
        generateFakeGraphicContent,
        isGraphicAd,
        cleanGraphicData,
        GRAPHIC_TYPE_MAP
    };
}
