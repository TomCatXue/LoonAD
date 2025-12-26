/**
 * 支付宝广告核心处理脚本
 * 版本: 1.3.4
 * 作者: TomCatXue
 * 功能: 处理支付宝广告API请求，支持多种响应模式
 */

// 获取参数
const args = typeof $argument !== 'undefined' ? $argument : '';
const params = {};
if (args) {
    args.split('&').forEach(item => {
        const [key, value] = item.split('=');
        if (key && value !== undefined) {
            params[key] = value;
        }
    });
}

// 配置
const config = {
    responseMode: params.response_mode || 'reject', // reject, empty, modify
    enableLogging: params.logging === 'true',
    moduleName: '支付宝广告屏蔽',
    version: '1.3.4'
};

// 日志函数
function log(message, level = 'INFO') {
    if (config.enableLogging) {
        const timestamp = new Date().toLocaleTimeString();
        const logMsg = `[${timestamp}] [${level}] ${config.moduleName}: ${message}`;
        console.log(logMsg);
        
        // 保存重要日志
        if (level === 'ERROR' || level === 'WARN') {
            try {
                const logs = $persistentStore.read('AlipayAdLogs') || '';
                const newLogs = logs + logMsg + '\n';
                if (newLogs.length > 10000) {
                    $persistentStore.write(newLogs.slice(-5000), 'AlipayAdLogs');
                } else {
                    $persistentStore.write(newLogs, 'AlipayAdLogs');
                }
            } catch (e) {}
        }
    }
}

// 检查是否是广告API
function isAdAPI(url) {
    const adAPIs = [
        'alipay.data.dataservice.ad.agentreportdata.query',
        'alipay.data.dataservice.ad.reportdata.query',
        'alipay.data.dataservice.ad.reportmetric.query',
        'alipay.data.dataservice.ad.promotepage.batchquery',
        'alipay.data.dataservice.ad.promotepage.download',
        'alipay.data.dataservice.xlight.task.query',
        'alipay.data.dataservice.ad.',
        'alipay.marketing.',
        'alipay.commerce.operation.'
    ];
    
    const lowerUrl = url.toLowerCase();
    for (const api of adAPIs) {
        if (lowerUrl.includes(api.toLowerCase())) {
            log(`匹配广告API: ${api}`);
            return true;
        }
    }
    
    // 检查特定模式
    if (lowerUrl.includes('/ad/') || lowerUrl.includes('/ads/') || lowerUrl.includes('/advert/')) {
        log(`匹配广告路径模式`);
        return true;
    }
    
    return false;
}

// 生成屏蔽响应
function generateBlockResponse() {
    log(`使用响应模式: ${config.responseMode}`);
    
    switch (config.responseMode) {
        case 'empty':
            return {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'max-age=3600'
                },
                body: JSON.stringify({
                    success: true,
                    data: null,
                    result: {}
                })
            };
            
        case 'modify':
            return {
                status: 200,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    success: true,
                    code: "10000",
                    msg: "Success",
                    data: {
                        totalSize: 0,
                        pageSize: 10,
                        items: [],
                        facets: []
                    }
                })
            };
            
        case 'reject':
        default:
            return {
                status: 403,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    success: false,
                    code: "BLOCKED_BY_AD_FILTER",
                    msg: "广告内容已被过滤",
                    subCode: "AD_ACCESS_DENIED",
                    subMsg: "This ad request has been blocked"
                })
            };
    }
}

// 主处理函数
if (typeof $response !== 'undefined') {
    const url = $request?.url || '';
    
    // 检查是否是广告API
    if (isAdAPI(url)) {
        // 记录统计
        try {
            const count = parseInt($persistentStore.read('AlipayAdBlockCount') || '0');
            $persistentStore.write((count + 1).toString(), 'AlipayAdBlockCount');
            $persistentStore.write(new Date().toISOString(), 'AlipayAdLastBlockTime');
        } catch (e) {}
        
        // 返回屏蔽响应
        $done(generateBlockResponse());
    } else {
        $done({});
    }
} else {
    // 初始化
    log(`脚本加载完成 v${config.version}`);
    log(`响应模式: ${config.responseMode}`);
    $done({});
}
