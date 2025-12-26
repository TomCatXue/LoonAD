/***********************************
> 应用名称：支付宝任务广告屏蔽
> 脚本功能：屏蔽任务广告组件和相关API
> 作者：TomCatXue
> 特别说明：本脚本仅供学习交流使用

[rewrite_local]
# 支付宝任务广告屏蔽

[mitm]
hostname = xlight.alipay.com, openapi.alipay.com
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
const adType = args.type || 'taskquery';
const enableLogging = args.logging === 'true';
const responseMode = args.mode || 'reject';

// ============================================
// 任务广告类型映射
// ============================================
const TASK_TYPE_MAP = {
    'taskquery': '任务广告状态查询',
    'xlight': '任务广告组件',
    'default': '任务广告'
};

// ============================================
// 任务数据模型
// ============================================
const TASK_DATA_MODEL = {
    adBizId: '',
    taskTitle: '',
    taskSubTitle: '',
    adMerchantLogo: '',
    adMerchantName: '',
    taskRewardName: '',
    taskRewardAmount: '',
    taskClickButtonDescription: '',
    taskStatus: 'FINISHED',  // 默认已完成
    taskCategory: 'Other'
};

// ============================================
// 日志函数
// ============================================
function log(message, level = 'INFO') {
    if (enableLogging) {
        const timestamp = new Date().toLocaleTimeString();
        const typeName = TASK_TYPE_MAP[adType] || adType;
        const logLevel = level === 'ERROR' ? '🔴' : level === 'WARN' ? '🟡' : '🔵';
        console.log(`[${timestamp}] ${logLevel} [任务广告-${typeName}] ${message}`);
    }
}

// ============================================
// 生成空任务列表
// ============================================
function generateEmptyTaskList() {
    return {
        success: true,
        code: "10000",
        msg: "Success",
        data: [],
        result: {
            list: [],
            total: 0,
            pageSize: 10,
            currentPage: 1,
            totalPages: 0,
            hasMore: false
        }
    };
}

// ============================================
// 生成已完成的任务列表（用于迷惑广告组件）
// ============================================
function generateCompletedTaskList(count = 3) {
    const tasks = [];
    const taskTitles = [
        "浏览精选商品",
        "参与品牌活动",
        "完成新手任务",
        "关注品牌店铺",
        "分享商品给好友"
    ];
    
    for (let i = 0; i < count; i++) {
        const task = {
            ...TASK_DATA_MODEL,
            adBizId: `TASK_${Date.now()}_${i}`,
            taskTitle: taskTitles[i % taskTitles.length],
            taskSubTitle: "任务已完成",
            taskClickButtonDescription: "已完成",
            taskStatus: "FINISHED",
            taskRewardAmount: "0"
        };
        tasks.push(task);
    }
    
    return {
        success: true,
        code: "10000",
        msg: "Success",
        data: tasks,
        result: {
            list: tasks,
            total: tasks.length,
            pageSize: 10,
            currentPage: 1,
            totalPages: 1,
            hasMore: false
        }
    };
}

// ============================================
// 清理任务广告数据
// ============================================
function cleanTaskAdData(originalData) {
    if (!originalData || typeof originalData !== 'object') {
        return generateEmptyTaskList();
    }
    
    // 尝试清理广告数据
    const cleaned = { ...originalData };
    
    // 清理列表数据
    if (cleaned.data && Array.isArray(cleaned.data)) {
        cleaned.data = cleaned.data.filter(task => {
            // 移除所有进行中的任务，只保留已完成或无效的任务
            return !task || task.taskStatus === 'FINISHED' || task.taskStatus === 'EXPIRED';
        });
        
        if (cleaned.data.length === 0) {
            cleaned.data = [];
        }
    }
    
    // 清理result中的列表数据
    if (cleaned.result && cleaned.result.list && Array.isArray(cleaned.result.list)) {
        cleaned.result.list = cleaned.result.list.filter(task => {
            return !task || task.taskStatus === 'FINISHED' || task.taskStatus === 'EXPIRED';
        });
        
        if (cleaned.result.list.length === 0) {
            cleaned.result.list = [];
            cleaned.result.total = 0;
            cleaned.result.hasMore = false;
        }
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
    
    // 如果是请求阶段，直接拒绝
    if (typeof $request !== 'undefined') {
        return {
            status: 403,
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                success: false,
                code: "TASK_AD_BLOCKED",
                msg: "任务广告请求已被屏蔽",
                subCode: "ACCESS_DENIED"
            })
        };
    }
    
    // 响应阶段处理
    switch(responseMode) {
        case 'empty':
            // 返回空任务列表
            return {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'max-age=300'
                },
                body: JSON.stringify(generateEmptyTaskList())
            };
            
        case 'modify':
            // 修改响应，返回已完成的任务或空列表
            try {
                if (typeof $response !== 'undefined' && $response.body) {
                    let originalData;
                    try {
                        originalData = JSON.parse($response.body);
                    } catch(e) {
                        log(`JSON解析失败: ${e}`, 'ERROR');
                        // 解析失败时返回已完成的任务列表
                        return {
                            status: 200,
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify(generateCompletedTaskList(0))
                        };
                    }
                    
                    // 清理广告数据
                    const cleanedData = cleanTaskAdData(originalData);
                    
                    // 如果清理后没有任务，使用已完成的任务列表迷惑组件
                    if ((!cleanedData.data || cleanedData.data.length === 0) && 
                        (!cleanedData.result || !cleanedData.result.list || cleanedData.result.list.length === 0)) {
                        log('原始数据没有有效任务，返回空列表', 'INFO');
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
            // 修改失败时返回空列表
            return {
                status: 200,
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(generateEmptyTaskList())
            };
            
        case 'reject':
        default:
            // 直接拒绝任务广告
            return {
                status: 403,
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    success: false,
                    code: "NO_TASK_AVAILABLE",
                    msg: "暂无可用任务",
                    subCode: "TASK_BLOCKED",
                    subMsg: "任务广告已被屏蔽"
                })
            };
    }
}

// ============================================
// 主处理函数
// ============================================
function main() {
    const typeName = TASK_TYPE_MAP[adType] || adType;
    log(`开始处理: ${typeName}`, 'INFO');
    
    if (typeof $request !== 'undefined') {
        log(`请求URL: ${$request.url}`, 'INFO');
        log(`请求方法: ${$request.method}`, 'INFO');
    }
    
    // 记录屏蔽统计
    try {
        const statsKey = `TaskAd_${adType}_BlockCount`;
        const count = parseInt($persistentStore.read(statsKey) || '0');
        $persistentStore.write((count + 1).toString(), statsKey);
        $persistentStore.write(new Date().toISOString(), `TaskAd_${adType}_LastBlock`);
        log(`屏蔽次数: ${count + 1}`, 'INFO');
        
        // 记录总屏蔽次数
        const totalKey = 'TaskAd_TotalBlockCount';
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
    
    // 错误时返回空任务列表
    $done({
        status: 200,
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(generateEmptyTaskList())
    });
}

// ============================================
// 导出函数
// ============================================
if (typeof module !== 'undefined') {
    module.exports = {
        parseArgs,
        generateEmptyTaskList,
        generateCompletedTaskList,
        cleanTaskAdData,
        TASK_TYPE_MAP,
        TASK_DATA_MODEL
    };
}
