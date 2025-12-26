/***********************************
> 应用名称：支付宝广告控制中心
> 脚本功能：提供广告屏蔽统计和控制接口
> 作者：TomCatXue
> 特别说明：本脚本仅供学习交流使用

[rewrite_local]
# 支付宝广告控制中心

[mitm]
hostname = localhost, 127.0.0.1
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
const action = args.action || 'status';
const enableLogging = true; // 控制中心总是记录日志

// ============================================
// 日志函数
// ============================================
function log(message, level = 'INFO') {
    const timestamp = new Date().toLocaleTimeString();
    const logLevel = level === 'ERROR' ? '🔴' : level === 'WARN' ? '🟡' : '🔵';
    console.log(`[${timestamp}] ${logLevel} [广告控制中心] ${message}`);
}

// ============================================
// 广告类型定义
// ============================================
const AD_CATEGORIES = {
    '广告API': [
        'agentreport', 'reportdata', 'reportmetric', 'promotepage'
    ],
    '任务广告': [
        'taskquery', 'xlight'
    ],
    '激励广告': [
        'rewarded', 'productfeed', 'incentive'
    ],
    '信息流广告': [
        'feeds', 'mss'
    ],
    '封面广告': [
        'cover', 'splash'
    ],
    '图文广告': [
        'graphic', 'banner'
    ],
    '小程序插件': [
        'miniapp', 'traffic', 'ams'
    ]
};

// ============================================
// 获取屏蔽统计
// ============================================
function getBlockStats() {
    const stats = {
        total: 0,
        byCategory: {},
        byType: {},
        today: 0,
        recent: []
    };
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();
    
    // 遍历所有广告类型
    for (const [category, types] of Object.entries(AD_CATEGORIES)) {
        stats.byCategory[category] = 0;
        
        for (const type of types) {
            try {
                const countKey = getStatsKey(type);
                const count = parseInt($persistentStore.read(countKey) || '0');
                
                stats.byType[type] = count;
                stats.byCategory[category] += count;
                stats.total += count;
                
                // 检查今日屏蔽
                const lastBlockKey = getLastBlockKey(type);
                const lastBlockTime = $persistentStore.read(lastBlockKey);
                if (lastBlockTime) {
                    const lastTime = new Date(lastBlockTime).getTime();
                    if (lastTime >= todayTimestamp) {
                        stats.today++;
                    }
                    
                    // 添加到最近记录
                    if (stats.recent.length < 10) {
                        stats.recent.push({
                            type: type,
                            time: lastBlockTime,
                            count: count
                        });
                    }
                }
            } catch(e) {
                log(`获取 ${type} 统计失败: ${e}`, 'ERROR');
            }
        }
    }
    
    // 获取总屏蔽次数
    try {
        const totalKey = 'AlipayAd_TotalBlockCount';
        stats.total = parseInt($persistentStore.read(totalKey) || '0');
    } catch(e) {
        log(`获取总屏蔽次数失败: ${e}`, 'ERROR');
    }
    
    // 按时间排序最近记录
    stats.recent.sort((a, b) => new Date(b.time) - new Date(a.time));
    
    return stats;
}

// ============================================
// 获取配置信息
// ============================================
function getConfigInfo() {
    const configs = {};
    
    // 从持久化存储读取所有配置
    const configKeys = [
        'AlipayAdBlock_Config',
        'AlipayAd_Global_Enabled',
        'AlipayAd_Response_Mode',
        'AlipayAd_Logging_Enabled'
    ];
    
    for (const key of configKeys) {
        try {
            const value = $persistentStore.read(key);
            if (value) {
                configs[key] = value;
            }
        } catch(e) {
            log(`读取配置 ${key} 失败: ${e}`, 'ERROR');
        }
    }
    
    return configs;
}

// ============================================
// 清理统计数据
// ============================================
function clearStats() {
    let cleared = 0;
    
    // 清理所有广告类型的统计
    for (const types of Object.values(AD_CATEGORIES)) {
        for (const type of types) {
            try {
                const countKey = getStatsKey(type);
                const lastBlockKey = getLastBlockKey(type);
                
                $persistentStore.write('0', countKey);
                $persistentStore.write('', lastBlockKey);
                cleared++;
            } catch(e) {
                log(`清理 ${type} 统计失败: ${e}`, 'ERROR');
            }
        }
    }
    
    // 清理总统计
    try {
        $persistentStore.write('0', 'AlipayAd_TotalBlockCount');
        cleared++;
    } catch(e) {
        log(`清理总统计失败: ${e}`, 'ERROR');
    }
    
    // 清理日志
    try {
        $persistentStore.write('', 'AlipayAdLogs');
        cleared++;
    } catch(e) {
        log(`清理日志失败: ${e}`, 'ERROR');
    }
    
    return cleared;
}

// ============================================
// 获取日志内容
// ============================================
function getLogs(limit = 100) {
    try {
        const logs = $persistentStore.read('AlipayAdLogs') || '';
        const logLines = logs.split('\n').filter(line => line.trim());
        
        if (limit > 0 && logLines.length > limit) {
            return logLines.slice(-limit).join('\n');
        }
        
        return logLines.join('\n') || '暂无日志';
    } catch(e) {
        log(`获取日志失败: ${e}`, 'ERROR');
        return '获取日志失败';
    }
}

// ============================================
// 工具函数
// ============================================
function getStatsKey(adType) {
    // 根据广告类型生成统计key
    if (AD_CATEGORIES['广告API'].includes(adType)) {
        return `AlipayAdAPI_${adType}_BlockCount`;
    } else if (AD_CATEGORIES['任务广告'].includes(adType)) {
        return `TaskAd_${adType}_BlockCount`;
    } else if (AD_CATEGORIES['激励广告'].includes(adType)) {
        return `RewardedAd_${adType}_BlockCount`;
    } else if (AD_CATEGORIES['信息流广告'].includes(adType)) {
        return `FeedsAd_${adType}_BlockCount`;
    } else if (AD_CATEGORIES['封面广告'].includes(adType)) {
        return `CoverAd_${adType}_BlockCount`;
    } else if (AD_CATEGORIES['图文广告'].includes(adType)) {
        return `GraphicAd_${adType}_BlockCount`;
    } else if (AD_CATEGORIES['小程序插件'].includes(adType)) {
        return `MiniPlugin_${adType}_BlockCount`;
    }
    return `AlipayAd_${adType}_BlockCount`;
}

function getLastBlockKey(adType) {
    return getStatsKey(adType).replace('BlockCount', 'LastBlock');
}

// ============================================
// 生成响应
// ============================================
function generateResponse() {
    log(`处理控制请求: action=${action}`, 'INFO');
    
    switch(action) {
        case 'status':
            // 返回状态信息
            const stats = getBlockStats();
            const configs = getConfigInfo();
            
            return {
                status: 200,
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    success: true,
                    name: '支付宝广告屏蔽系统',
                    version: '5.0',
                    timestamp: new Date().toISOString(),
                    stats: stats,
                    config: configs,
                    categories: AD_CATEGORIES
                }, null, 2)
            };
            
        case 'stats':
            // 返回统计信息
            const statsData = getBlockStats();
            return {
                status: 200,
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    success: true,
                    stats: statsData,
                    timestamp: new Date().toISOString()
                }, null, 2)
            };
            
        case 'config':
            // 返回配置信息
            const configData = getConfigInfo();
            return {
                status: 200,
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    success: true,
                    config: configData,
                    timestamp: new Date().toISOString()
                }, null, 2)
            };
            
        case 'logs':
            // 返回日志
            const logs = getLogs(100);
            return {
                status: 200,
                headers: {'Content-Type': 'text/plain'},
                body: `=== 支付宝广告屏蔽日志 ===\n\n${logs}\n\n=== 日志结束 ===`
            };
            
        case 'clear':
            // 清理统计
            const cleared = clearStats();
            return {
                status: 200,
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    success: true,
                    message: `已清理 ${cleared} 项统计数据`,
                    timestamp: new Date().toISOString()
                })
            };
            
        case 'enable':
            // 启用广告屏蔽
            try {
                $persistentStore.write('true', 'AlipayAd_Global_Enabled');
                log('广告屏蔽已启用', 'INFO');
                return {
                    status: 200,
                    body: '✅ 支付宝广告屏蔽已启用'
                };
            } catch(e) {
                return {
                    status: 500,
                    body: `❌ 启用失败: ${e}`
                };
            }
            
        case 'disable':
            // 禁用广告屏蔽
            try {
                $persistentStore.write('false', 'AlipayAd_Global_Enabled');
                log('广告屏蔽已禁用', 'INFO');
                return {
                    status: 200,
                    body: '❌ 支付宝广告屏蔽已禁用'
                };
            } catch(e) {
                return {
                    status: 500,
                    body: `❌ 禁用失败: ${e}`
                };
            }
            
        default:
            // 未知操作
            return {
                status: 400,
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    success: false,
                    message: '未知操作',
                    availableActions: [
                        'status', 'stats', 'config', 'logs', 
                        'clear', 'enable', 'disable'
                    ]
                })
            };
    }
}

// ============================================
// 主处理函数
// ============================================
function main() {
    log('广告控制中心启动', 'INFO');
    
    // 只处理本地控制请求
    const url = $request?.url || '';
    if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
        log(`非控制请求，跳过处理: ${url}`, 'WARN');
        $done({});
        return;
    }
    
    try {
        const response = generateResponse();
        $done(response);
    } catch(error) {
        log(`控制中心处理错误: ${error}`, 'ERROR');
        $done({
            status: 500,
            body: `控制中心错误: ${error}`
        });
    }
}

// ============================================
// 执行
// ============================================
try {
    main();
} catch(error) {
    console.log(`[广告控制中心] 致命错误: ${error}`);
    $done({
        status: 500,
        body: '控制中心发生错误'
    });
}
