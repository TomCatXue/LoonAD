/***********************************
> 应用名称：支付宝小程序插件屏蔽
> 脚本功能：屏蔽小程序插件和流量位
> 作者：TomCatXue
> 特别说明：本脚本仅供学习交流使用

[rewrite_local]
# 支付宝小程序插件屏蔽

[mitm]
hostname = *.alipay.com, *.alipayobjects.com
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
const pluginType = args.type || 'miniapp';
const enableLogging = args.logging === 'true';
const responseMode = args.mode || 'reject';

// ============================================
// 插件类型映射
// ============================================
const PLUGIN_TYPE_MAP = {
    'miniapp': '小程序插件',
    'traffic': '小程序流量位',
    'ams': 'AMS插件系统',
    'xlight': '灯火平台插件',
    'default': '小程序插件'
};

// ============================================
// 日志函数
// ============================================
function log(message, level = 'INFO') {
    if (enableLogging) {
        const timestamp = new Date().toLocaleTimeString();
        const typeName = PLUGIN_TYPE_MAP[pluginType] || pluginType;
        const logLevel = level === 'ERROR' ? '🔴' : level === 'WARN' ? '🟡' : '🔵';
        console.log(`[${timestamp}] ${logLevel} [小程序插件-${typeName}] ${message}`);
    }
}

// ============================================
// 生成空插件响应
// ============================================
function generateEmptyPluginResponse() {
    const emptyResponses = {
        'miniapp': {
            success: true,
            code: "10000",
            msg: "Success",
            data: {
                plugins: [],
                enabled: false,
                config: {},
                version: "0.0.0"
            }
        },
        'traffic': {
            success: true,
            code: "10000",
            msg: "Success",
            data: {
                trafficList: [],
                positions: [],
                enabled: false,
                config: {}
            }
        },
        'ams': {
            success: true,
            code: "10000",
            msg: "Success",
            data: {
                amsPlugins: [],
                enabled: false,
                config: {},
                status: "disabled"
            }
        },
        'xlight': {
            success: true,
            code: "10000",
            msg: "Success",
            data: {
                xlightPlugins: [],
                provider: "",
                version: "",
                enabled: false
            }
        },
        'default': {
            success: true,
            code: "NO_PLUGIN",
            msg: "无可用插件",
            data: null
        }
    };
    
    return emptyResponses[pluginType] || emptyResponses.default;
}

// ============================================
// 生成禁用插件配置
// ============================================
function generateDisabledPluginConfig() {
    return {
        success: true,
        code: "PLUGIN_DISABLED",
        msg: "插件已禁用",
        data: {
            enabled: false,
            plugins: [],
            config: {
                disableReason: "user_preference",
                disableTime: Date.now(),
                canEnable: false
            },
            metadata: {
                blockedBy: "AdBlocker",
                version: "blocked"
            }
        }
    };
}

// ============================================
// 检测插件广告内容
// ============================================
function detectPluginAdContent(data) {
    if (!data || typeof data !== 'object') {
        return false;
    }
    
    const adIndicators = [
        'ad', 'ads', 'advert', 'sponsor', 'promotion',
        'tanx', 'alimama', 'xlight', 'feeds',
        'reward', 'incentive', 'task',
        'banner', 'popup', 'splash', 'cover'
    ];
    
    // 深度检查数据中的广告内容
    function deepCheck(obj) {
        if (!obj || typeof obj !== 'object') return false;
        
        // 检查字段名
        for (const key in obj) {
            const lowerKey = key.toLowerCase();
            for (const indicator of adIndicators) {
                if (lowerKey.includes(indicator.toLowerCase())) {
                    return true;
                }
            }
            
            // 递归检查值
            if (deepCheck(obj[key])) {
                return true;
            }
        }
        
        // 检查字符串值
        if (typeof obj === 'string') {
            const lowerStr = obj.toLowerCase();
            for (const indicator of adIndicators) {
                if (lowerStr.includes(indicator.toLowerCase())) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    return deepCheck(data);
}

// ============================================
// 清理插件数据
// ============================================
function cleanPluginData(originalData) {
    if (!originalData || typeof originalData !== 'object') {
        return generateEmptyPluginResponse();
    }
    
    const cleaned = { ...originalData };
    
    // 检测并清理广告内容
    if (detectPluginAdContent(cleaned.data)) {
        log('检测到插件中的广告内容，进行清理', 'WARN');
        cleaned.data = {
            enabled: false,
            plugins: [],
            config: {},
            adContentRemoved: true
        };
    }
    
    // 确保插件被禁用
    if (cleaned.data && typeof cleaned.data === 'object') {
        cleaned.data.enabled = false;
        
        // 清理插件列表
        if (cleaned.data.plugins && Array.isArray(cleaned.data.plugins)) {
            cleaned.data.plugins = cleaned.data.plugins.filter(plugin => {
                // 只保留非广告插件
                if (!plugin || typeof plugin !== 'object') return false;
                
                const pluginStr = JSON.stringify(plugin).toLowerCase();
                const adKeywords = ['ad', 'xlight', 'feeds', 'reward', 'task'];
                return !adKeywords.some(keyword => pluginStr.includes(keyword));
            });
        }
    }
    
    // 设置成功状态
    cleaned.success = true;
    cleaned.code = "PLUGIN_FILTERED";
    cleaned.msg = "插件内容已过滤";
    
    return cleaned;
}

// ============================================
// 生成屏蔽响应
// ============================================
function generateBlockResponse() {
    log(`使用响应模式: ${responseMode}`, 'INFO');
    
    // 检查是否是插件JS文件请求
    if (typeof $request !== 'undefined') {
        const url = $request.url.toLowerCase();
        if (url.includes('.js') && (url.includes('plugin') || url.includes('xlight') || url.includes('ad'))) {
            log(`拦截插件JS文件: ${url}`, 'WARN');
            return {
                status: 404,
                headers: {'Content-Type': 'application/javascript'},
                body: '// Plugin blocked by AdBlocker'
            };
        }
    }
    
    switch(responseMode) {
        case 'empty':
            // 返回空插件数据
            return {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'max-age=3600'
                },
                body: JSON.stringify(generateEmptyPluginResponse())
            };
            
        case 'modify':
            // 修改响应，禁用插件
            try {
                if (typeof $response !== 'undefined' && $response.body) {
                    let originalData;
                    try {
                        originalData = JSON.parse($response.body);
                    } catch(e) {
                        log(`JSON解析失败: ${e}`, 'ERROR');
                        // 返回禁用配置
                        return {
                            status: 200,
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify(generateDisabledPluginConfig())
                        };
                    }
                    
                    // 清理插件数据
                    const cleanedData = cleanPluginData(originalData);
                    
                    return {
                        status: 200,
                        headers: $response.headers,
                        body: JSON.stringify(cleanedData)
                    };
                }
            } catch(error) {
                log(`修改响应失败: ${error}`, 'ERROR');
            }
            // 修改失败时返回禁用配置
            return {
                status: 200,
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(generateDisabledPluginConfig())
            };
            
        case 'reject':
        default:
            // 直接拒绝插件请求
            return {
                status: 403,
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    success: false,
                    code: "PLUGIN_BLOCKED",
                    msg: "插件请求已被屏蔽",
                    subCode: "AD_PLUGIN_BLOCKED",
                    subMsg: PLUGIN_TYPE_MAP[pluginType] || "广告插件"
                })
            };
    }
}

// ============================================
// 主处理函数
// ============================================
function main() {
    const typeName = PLUGIN_TYPE_MAP[pluginType] || pluginType;
    log(`开始处理: ${typeName}`, 'INFO');
    
    if (typeof $request !== 'undefined') {
        log(`请求URL: ${$request.url}`, 'INFO');
        log(`请求方法: ${$request.method}`, 'INFO');
    }
    
    // 记录屏蔽统计
    try {
        const statsKey = `MiniPlugin_${pluginType}_BlockCount`;
        const count = parseInt($persistentStore.read(statsKey) || '0');
        $persistentStore.write((count + 1).toString(), statsKey);
        $persistentStore.write(new Date().toISOString(), `MiniPlugin_${pluginType}_LastBlock`);
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
    
    // 错误时返回禁用配置
    $done({
        status: 200,
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(generateDisabledPluginConfig())
    });
}

// ============================================
// 导出函数
// ============================================
if (typeof module !== 'undefined') {
    module.exports = {
        parseArgs,
        generateEmptyPluginResponse,
        generateDisabledPluginConfig,
        detectPluginAdContent,
        cleanPluginData,
        PLUGIN_TYPE_MAP
    };
}
