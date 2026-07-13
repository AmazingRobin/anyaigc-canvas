import { useLanguageStore, type LanguageName } from "@/stores/use-language-store";
import { workbenchErrorText } from "@/lib/i18n-workbench";

export const canvasZhToEn = {
    "主页": "Home",
    "我的画布": "My Canvas",
    "新建画布": "New Canvas",
    "未命名画布": "Untitled Canvas",
    "画布库": "Canvas Library",
    "还没有画布": "No Canvases Yet",
    "新建一个画布后，就可以独立保存节点、连线和画布外观。": "Create a canvas to save its nodes, connections, and appearance independently.",
    "导入画布": "Import Canvas",
    "导出选中": "Export Selected",
    "删除画布": "Delete Canvas",
    "删除画布？": "Delete Canvas?",
    "取消": "Cancel",
    "删除": "Delete",
    "保存": "Save",
    "保存名称": "Save Name",
    "取消重命名": "Cancel Rename",
    "导出": "Export",
    "重命名": "Rename",
    "更新于": "Updated",
    "全选": "Select All",
    "反选": "Invert Selection",
    "导入失败，请选择有效的画布压缩包": "Import failed. Select a valid canvas archive.",
    "正在打开画布": "Opening Canvas",
    "正在加载画布": "Loading Canvas",
    "打开画布菜单": "Open Canvas Menu",
    "双击修改画布名称": "Double-click To Rename Canvas",
    "删除当前画布": "Delete Current Canvas",
    "导入素材": "Import Asset",
    "撤销": "Undo",
    "重做": "Redo",
    "快捷键": "Shortcuts",
    "拖动画布": "Drag Canvas",
    "平移视图": "Pan View",
    "滚轮": "Mouse Wheel",
    "缩放画布": "Zoom Canvas",
    "缩放滑杆": "Zoom Slider",
    "精确调整缩放": "Adjust Zoom Precisely",
    "框选多个节点": "Select Multiple Nodes",
    "追加选择节点": "Add Nodes To Selection",
    "全选节点": "Select All Nodes",
    "复制 / 粘贴节点": "Copy / Paste Nodes",
    "复制 / 粘贴节点，或粘贴剪切板文本/图片": "Copy / paste nodes, or paste clipboard text/images",
    "删除选中": "Delete Selected",
    "取消选择并关闭浮层": "Clear Selection And Close Overlays",
    "拖入图片/视频/音频": "Drag In Images / Videos / Audio",
    "上传到画布": "Upload To Canvas",
    "移动选择": "Move / Select",
    "移动/选择": "Move / Select",
    "文本": "Text",
    "图片": "Image",
    "视频": "Video",
    "音频": "Audio",
    "生成配置": "Generation Config",
    "上传素材": "Upload Assets",
    "我的素材": "My Assets",
    "画布外观": "Canvas Appearance",
    "主题模式": "Theme Mode",
    "浅色": "Light",
    "深色": "Dark",
    "网格样式": "Grid Style",
    "点": "Dots",
    "线": "Lines",
    "空白": "Blank",
    "图片信息": "Image Info",
    "切换到浅色主题": "Switch To Light Theme",
    "切换到深色主题": "Switch To Dark Theme",
    "打开小地图": "Open Mini Map",
    "关闭小地图": "Close Mini Map",
    "重置视图": "Reset View",
    "放大/缩小画布": "Zoom Canvas",
    "清空画布": "Clear Canvas",
    "清空画布？": "Clear Canvas?",
    "清空": "Clear",
    "这会删除当前画布上的所有节点和连线。": "This will delete every node and connection on the current canvas.",
    "停止生成？": "Stop Generation?",
    "当前生成请求会被中断，已经生成完成的内容会保留。": "The current request will be interrupted. Completed results will be kept.",
    "停止": "Stop",
    "继续生成": "Continue Generating",
    "生成中": "Generating",
    "生成失败": "Generation Failed",
    "重试": "Retry",
    "未知节点": "Unknown Node",
    "用文本生图": "Generate Image From Text",
    "生图": "Generate Image",
    "双击编辑文字": "Double-click To Edit Text",
    "空图片节点": "Empty Image Node",
    "空视频节点": "Empty Video Node",
    "空音频节点": "Empty Audio Node",
    "音频参考": "Audio Reference",
    "图片组已展开": "Image Group Expanded",
    "图片组已收起": "Image Group Collapsed",
    "设为主图": "Set As Primary",
    "引用该节点生成": "Generate From This Node",
    "文本生成": "Text Generation",
    "图片生成": "Image Generation",
    "视频生成": "Video Generation",
    "配置节点": "Config Node",
    "脚本、广告词、品牌文案": "Scripts, ad copy, and brand copy",
    "模型、尺寸、数量和输入顺序": "Model, size, count, and input order",
    "配置节点之间不能连接": "Config nodes cannot be connected to each other.",
    "选择素材": "Choose Asset",
    "搜索素材": "Search Assets",
    "没有素材": "No Assets",
    "插入": "Insert",
    "提示词库": "Prompt Library",
    "组装提示词": "Compose Prompt",
    "输入提示词，按 @ 引用连接的图片或文本": "Enter a prompt. Use @ to reference connected images or text.",
    "@ 引用已连接素材，发送前按当前连接重新编号": "@ references connected assets and is renumbered from current connections before sending.",
    "参考图": "Reference Images",
    "参考视频": "Reference Videos",
    "参考音频": "Reference Audio",
    "比例": "Ratio",
    "编辑": "Edit",
    "编辑文字": "Edit Text",
    "编辑文本": "Edit Text",
    "停止生成": "Stop Generation",
    "描述要生成的视频内容": "Describe The Video To Generate",
    "描述要生成的音频内容": "Describe The Audio To Generate",
    "描述要生成的图片内容": "Describe The Image To Generate",
    "请输入你想要把这张图修改成什么": "Describe How You Want To Edit This Image",
    "请输入你想要将本段文本修改成什么": "Describe How You Want To Edit This Text",
    "请输入你想要生成的文本内容": "Describe The Text To Generate",
    "自定义工具栏": "Customize Toolbar",
    "选择你想在图片节点编辑栏中使用的快捷工具。": "Choose the shortcuts to show in the image node toolbar.",
    "节点预览": "Node Preview",
    "显示按钮文字": "Show Button Labels",
    "查看大图": "View Full Image",
    "多角度": "Multiple Angles",
    "裁剪": "Crop",
    "局部编辑": "Local Edit",
    "切图": "Split Image",
    "超分": "Upscale",
    "存素材": "Save To Assets",
    "下载": "Download",
    "复制": "Copy",
    "查看图片详情": "View Image Details",
    "复制生成该图片的提示词": "Copy The Prompt Used For This Image",
    "复制提示词": "Copy Prompt",
    "提示词已复制": "Prompt Copied",
    "暂无可复制的提示词": "No Prompt Available To Copy",
    "替换图片": "Replace Image",
    "替换视频": "Replace Video",
    "替换音频": "Replace Audio",
    "上传图片": "Upload Image",
    "上传视频": "Upload Video",
    "上传音频": "Upload Audio",
    "下载图片": "Download Image",
    "下载视频": "Download Video",
    "下载音频": "Download Audio",
    "查看节点信息": "View Node Info",
    "配置快捷工具": "Configure Shortcuts",
    "信息": "Info",
    "节点信息": "Node Info",
    "类型": "Type",
    "位置": "Position",
    "尺寸": "Size",
    "图片组": "Image Group",
    "提示词": "Prompt",
    "图片大小": "Image Size",
    "裁剪图片": "Crop Image",
    "裁剪尺寸": "Crop Size",
    "原图": "Original",
    "自由比例": "Free Ratio",
    "锁定比例": "Lock Ratio",
    "切换为等比缩放": "Lock Aspect Ratio",
    "切换为自由比例": "Use Free Ratio",
    "确认裁剪": "Confirm Crop",
    "裁剪并生成新节点": "Crop And Create New Node",
    "调整裁剪框": "Adjust Crop Area",
    "切分图片": "Split Image",
    "按行列切分图片": "Split Image By Rows And Columns",
    "行数": "Rows",
    "列数": "Columns",
    "加横线": "Add Horizontal Line",
    "加竖线": "Add Vertical Line",
    "删除线": "Delete Line",
    "重置": "Reset",
    "子节点": "Child Nodes",
    "平均单块": "Average Tile",
    "生成子节点": "Create Child Nodes",
    "读取中": "Loading",
    "未知": "Unknown",
    "局部遮罩编辑": "Local Mask Edit",
    "画笔": "Brush",
    "擦除": "Erase",
    "笔刷大小": "Brush Size",
    "修改要求": "Edit Instructions",
    "例如：把选中区域改成金属材质，保持原图光影": "For example: Change the selected area to metal while preserving the original lighting.",
    "请输入修改要求": "Enter Edit Instructions",
    "请先涂抹局部区域": "Paint The Area To Edit First",
    "AI 修改": "AI Edit",
    "图片放大": "Upscale Image",
    "源图": "Source Image",
    "目标像素": "Target Pixels",
    "放大算法": "Upscaling Algorithm",
    "高清插值": "High-quality Interpolation",
    "适合照片和细节图": "Best For Photos And Detailed Images",
    "双线性": "Bilinear",
    "平滑、速度快": "Smooth And Fast",
    "最近邻": "Nearest Neighbor",
    "适合像素风格": "Best For Pixel Art",
    "输出尺寸": "Output Size",
    "生成放大图": "Create Upscaled Image",
    "图片已达到 4K，无需放大": "The Image Is Already 4K And Does Not Need Upscaling",
    "图片已达到当前目标像素，无需放大": "The Image Already Meets The Target Resolution",
    "AI 多角度": "AI Multi-angle",
    "左右角度": "Horizontal Angle",
    "俯仰角度": "Pitch Angle",
    "镜头距离": "Camera Distance",
    "标准": "Standard",
    "广角": "Wide Angle",
    "左侧只预览方向，结果会基于原图重新生成": "The preview only shows direction. The result will be regenerated from the original image.",
    "生成角度": "Generate Angle",
    "AI 超分": "AI Upscale",
    "暂未实现": "Not Implemented Yet",
    "图片详情": "Image Details",
    "画布助手": "Canvas Assistant",
    "工具确认": "Tool Approval",
    "新对话": "New Conversation",
    "删除全部": "Delete All",
    "配置": "Settings",
    "描述你想让 Agent 如何操作画布": "Describe How You Want The Agent To Work On The Canvas",
    "删除对话记录": "Delete Conversation History",
    "删除对话记录？": "Delete Conversation History?",
    "将删除": "This Will Delete",
    "条对话记录，此操作不可撤销。": "conversation records. This cannot be undone.",
    "收起对话": "Collapse Conversation",
    "选择文本模型": "Choose Text Model",
    "暂无文本模型": "No Text Models",
    "网站": "Web",
    "本机": "Local",
    "当前": "Current",
    "进入": "Open",
    "网站 Agent 的对话记录会显示在这里": "Web Agent conversation history will appear here.",
    "连接配置": "Connection Settings",
    "网站 Agent 直接使用当前网页配置的文本模型和 API。": "The Web Agent uses the text model and API configured on this page.",
    "文本模型": "Text Model",
    "未配置模型": "No Model Configured",
    "暂无历史": "No History",
    "历史": "History",
    "条": "items",
    "最近错误": "Latest Error",
    "排查日志": "Diagnostic Log",
    "原始 JSON": "Raw JSON",
    "工具调用": "Tool Call",
    "等待确认": "Awaiting Approval",
    "详情": "Details",
    "拒绝执行": "Reject",
    "批准执行": "Approve",
    "工具调用完成": "Tool Call Complete",
    "工具调用已取消": "Tool Call Cancelled",
    "移除图片": "Remove Image",
    "发送": "Send",
    "Agent 面板": "Agent Panel",
    "用户发送": "User Sent",
    "模型工具回复": "Model Tool Response",
    "工具执行结果": "Tool Result",
    "工具执行失败": "Tool Execution Failed",
    "本地 Agent": "Local Agent",
    "连接本地 Agent": "Connect Local Agent",
    "本地地址": "Local URL",
    "连接 Token": "Connect Token",
    "请填写本地 Agent 地址": "Enter The Local Agent URL",
    "本地 Agent 地址格式不正确": "The Local Agent URL Is Invalid",
    "连接失败，请检查地址和 token": "Connection Failed. Check The URL And Token.",
    "连接": "Connect",
    "断开": "Disconnect",
    "连接中": "Connecting",
    "已连接": "Connected",
    "未连接": "Disconnected",
    "未启用": "Disabled",
    "离线": "Offline",
    "刷新": "Refresh",
    "工作空间": "Workspace",
    "默认画布目录": "Default Canvas Directory",
    "当前工作空间还没有对话记录": "There Are No Conversations In This Workspace Yet",
    "连接本地 Agent 后显示历史记录": "Conversation History Appears After Connecting The Local Agent",
    "未命名对话": "Untitled Conversation",
    "删除记录": "Delete Record",
    "询问 Codex，或让它操作画布": "Ask Codex Or Have It Work On The Canvas",
    "复制命令": "Copy Command",
    "命令已复制": "Command Copied",
    "安装 Codex 插件": "Install Codex Plugin",
    "安装 Codex 插件后，画布会优先自动连接本机 Agent。": "After installing the Codex plugin, Canvas will try to connect to the local Agent automatically.",
    "在 Codex app 安装 Infinite Canvas 插件后，首次使用插件会自动启动本地 Agent。": "Install the Infinite Canvas plugin in the Codex app. The local Agent starts automatically on first use.",
    "回到这里点击连接，网页会自动读取本机 Agent 配置。": "Return here and click Connect. The page will read the local Agent configuration automatically.",
    "手动启动备用": "Manual Startup Fallback",
    "如果自动发现失败，再运行下面命令。": "Run the command below only if automatic discovery fails.",
    "默认自动读取 Local URL 和 Connect token，失败时再手动填写。": "Local URL and Connect token are detected automatically. Enter them manually only if detection fails.",
    "没有发现本地 Agent，请先在 Codex 使用插件或手动启动 Canvas Agent": "No local Agent was found. Use the Codex plugin or start Canvas Agent manually.",
    "自动发现，或手动填入 Connect token": "Auto-detect Or Enter The Connect Token Manually",
    "例如 http://127.0.0.1:17371": "For Example: http://127.0.0.1:17371",
    "连接失败": "Connection Failed",
    "连接断开": "Connection Lost",
    "本地 Agent 已连接": "Local Agent Connected",
    "本地 Agent 已接收": "Local Agent Received The Request",
    "发送中": "Sending",
    "发送失败": "Send Failed",
    "思考中": "Thinking",
    "已完成": "Completed",
    "本轮完成": "Turn Complete",
    "本轮失败": "Turn Failed",
    "请求失败": "Request Failed",
    "请求已取消": "Request Cancelled",
    "本地 Agent 请求失败": "Local Agent Request Failed",
    "本地 Agent 拒绝了请求": "The Local Agent Rejected The Request",
    "本地 Agent 连接失败或已断开": "The Local Agent Failed To Connect Or Disconnected",
    "读取历史失败": "Failed To Load History",
    "恢复对话失败": "Failed To Restore Conversation",
    "新建对话失败": "Failed To Create Conversation",
    "删除对话失败": "Failed To Delete Conversation",
    "记录已删除": "Record Deleted",
    "已创建会话": "Conversation Created",
    "已恢复会话": "Conversation Restored",
    "已创建 Codex 会话": "Codex Conversation Created",
    "日志": "Logs",
    "运行日志": "Runtime Logs",
    "日志已复制": "Logs Copied",
    "最近错误已复制": "Latest Error Copied",
    "已选中日志，请手动复制": "The Log Is Selected. Copy It Manually.",
    "暂无事件日志": "No Event Logs",
    "Codex 事件": "Codex Events",
    "Codex 回复": "Codex Response",
    "流式摘要": "Streaming Summary",
    "发送了图片": "Sent An Image",
    "错误": "Error",
    "出错": "Error",
    "操作失败": "Operation Failed",
    "关闭": "Close",
    "准备执行工具，等待确认。": "Preparing The Tool Call And Waiting For Approval.",
    "仍有待确认的画布工具调用": "A Canvas Tool Call Is Still Awaiting Approval",
    "已批准执行": "Execution Approved",
    "已拒绝执行": "Execution Rejected",
    "已取消": "Cancelled",
    "工具自动执行完成": "Automatic Tool Execution Complete",
    "前一个工具调用失败，未继续执行。": "The Previous Tool Call Failed, So Execution Stopped.",
    "工具续跑失败": "Failed To Continue Tool Execution",
    "工具完成": "Tool Complete",
    "工具失败": "Tool Failed",
    "工具执行完成": "Tool Execution Complete",
    "没有返回内容。": "No Content Was Returned.",
    "画布操作已执行。": "Canvas Operation Executed.",
    "画布操作失败": "Canvas Operation Failed",
    "模型没有返回工具调用，画布操作未执行。": "The Model Returned No Tool Call, So No Canvas Operation Was Performed.",
    "模型没有返回可执行的画布操作。": "The Model Returned No Executable Canvas Operation.",
    "工具上下文不完整，无法执行。": "The Tool Context Is Incomplete And Cannot Be Executed.",
    "用户取消了画布工具调用": "The User Cancelled The Canvas Tool Call",
    "图片附件超过 30MB，请删减后再发送。": "Image Attachments Exceed 30MB. Remove Some Before Sending.",
    "图片附件最多约 30MB。": "Image Attachments Can Total Up To About 30MB.",
    "图片过大": "Image Too Large",
    "移除引用": "Remove Reference",
    "同步": "Sync",
    "异步": "Async",
    "异步·4倍扣费": "Async · cost x4",
    "页面刷新后生成已中断，请重新生成。": "Generation Was Interrupted By The Page Refresh. Generate Again.",
    "部分本地素材读取失败，已先打开画布": "Some Local Assets Could Not Be Loaded. The Canvas Was Opened With The Available Assets.",
    "已忽略不支持的图片": "Unsupported Images Were Ignored",
    "已从剪切板添加图片": "Image Added From Clipboard",
    "已从剪切板添加文本": "Text Added From Clipboard",
    "没有可保存的文本": "There Is No Text To Save",
    "没有可保存的视频": "There Is No Video To Save",
    "没有可保存的图片": "There Is No Image To Save",
    "已加入我的素材": "Added To My Assets",
    "图片节点为空，无法反推提示词": "The Image Node Is Empty, So Its Prompt Cannot Be Reconstructed",
    "反推提示词": "Reconstruct Prompt",
    "反推提示词配置": "Prompt Reconstruction Config",
    "局部编辑结果": "Local Edit Result",
    "局部修改失败": "Local Edit Failed",
    "部分图片生成失败": "Some Images Failed To Generate",
    "全部图片生成失败": "All Images Failed To Generate",
    "找不到提示词，无法重试": "No Prompt Was Found For Retrying",
    "参考图片已丢失，无法继续重试": "The Reference Image Is Missing, So Retrying Is Not Possible",
    "文本节点为空，无法生图": "The Text Node Is Empty, So An Image Cannot Be Generated",
    "AI 生成": "AI Generation",
    "重新生成": "Regenerate",
    "确认工具调用": "Confirm Tool Call",
    "未生效": "No Changes",
    "执行失败": "Execution Failed",
    "执行完成": "Execution Completed",
    "对话": "Chat",
    "调整右侧面板宽度": "Resize Right Panel",
    "更多": "More",
    "图片节点": "Image Node",
    "快捷工具": "Quick Tools",
    "创建反推提示词的文本和配置节点": "Create Text And Config Nodes For Prompt Reconstruction",
    "添加蒙版遮罩后局部修改": "Paint A Mask To Edit A Local Area",
    "放大": "Enlarge",
    "放大图片分辨率": "Increase Image Resolution",
    "打开画布连接": "Connect The Canvas",
    "网页连接": "Web Connection",
    "广角镜头": "Wide-angle Lens",
    "移除节点": "Remove Node",
    "减小字号": "Decrease Font Size",
    "缩小": "Decrease",
    "增大字号": "Increase Font Size",
    "状态": "Status",
    "Ctrl / Cmd + 拖动": "Ctrl / Cmd + Drag",
    "Shift / Ctrl / Cmd + 点击": "Shift / Ctrl / Cmd + Click",
    "正在加载画布...": "Loading Canvas...",
    "正在打开画布...": "Opening Canvas...",
    "剪切板文本": "Clipboard Text",
    "画布文本": "Canvas Text",
    "画布视频": "Canvas Video",
    "画布图片": "Canvas Image",
    "拖动": "Drag",
    "点击": "Click",
    "打开本地 Codex 面板": "Open Local Codex Panel",
    "引用图片预览": "Referenced Image Preview",
} as const;

const canvasEnToZh = new Map<string, string>(Object.entries(canvasZhToEn).map(([zh, en]) => [en, zh]));
export const canvasAgentErrorZhToEn = {
    "当前没有已连接画布": "No canvas is currently connected",
    "画布操作超时": "Canvas operation timed out",
    "Codex app-server 没有返回 thread id": "Codex app-server did not return a thread id",
    "Codex app-server 没有返回 turn id": "Codex app-server did not return a turn id",
    "该 Codex 会话不属于当前画布工作空间": "This Codex conversation does not belong to the current canvas workspace",
    "仍有待确认的画布工具调用": "Canvas tool calls are still awaiting confirmation",
    "画布操作失败": "Canvas operation failed",
    "用户取消了画布工具调用": "The user cancelled the canvas tool call",
} as const;
const canvasAgentErrorEnToZh = new Map<string, string>(Object.entries(canvasAgentErrorZhToEn).map(([zh, en]) => [en, zh]));
export const canvasAgentErrorPrefixZhToEn = {
    "未知工具：": "Unknown tool: ",
    "图片附件无效：": "Invalid image attachment: ",
    "不支持的工具：": "Unsupported tool: ",
} as const;

const canvasAgentAppTextZhToEn = {
    "请填写本地 Agent 地址": "Enter the Local Agent address",
    "没有发现本地 Agent，请先在 Codex 使用插件或手动启动 Canvas Agent": "No Local Agent was found. Use the plugin in Codex or start Canvas Agent manually.",
    "本地 Agent 地址格式不正确": "The Local Agent address is invalid",
    "连接失败，请检查地址和 token": "Connection failed. Check the address and token.",
    "本地 Agent 连接失败或已断开": "Local Agent connection failed or was disconnected",
    "本地 Agent 拒绝了请求": "Local Agent rejected the request",
    "本地 Agent 请求失败": "Local Agent request failed",
    "读取图片失败": "Failed to read image",
    "图片读取失败": "Failed to read image",
    "模型没有返回工具调用，画布操作未执行。": "The model did not return a tool call, so no canvas action was performed.",
    "没有返回内容。": "No content returned.",
    "操作失败": "Operation failed",
    "工具参数错误": "Invalid tool arguments",
    "工具执行失败": "Tool execution failed",
    "前一个工具调用失败，未继续执行。": "The previous tool call failed, so execution stopped.",
    "工具上下文不完整，无法执行。": "The tool context is incomplete and cannot be executed.",
    "工具调用已取消": "Tool call cancelled",
    "模型没有返回可执行的画布操作。": "The model returned no executable canvas operation.",
    "画布当前没有连线可删除。": "The canvas has no connections to delete.",
    "没有找到要删除的连线。": "No connections to delete were found.",
    "这些节点已经存在对应连线，无需重复连接。": "These nodes are already connected.",
    "没有找到要连接的节点。": "No nodes to connect were found.",
    "画布当前没有生成配置节点可删除。": "The canvas has no generation config nodes to delete.",
    "没有找到要删除的节点。": "No nodes to delete were found.",
    "没有找到要更新的节点。": "No nodes to update were found.",
    "没有找到要选择的节点。": "No nodes to select were found.",
    "没有找到要触发生成的节点。": "No nodes to generate from were found.",
    "视图已经是目标状态。": "The view is already in the requested state.",
    "选区已经是目标状态。": "The selection is already in the requested state.",
    "工具已执行，但画布状态没有变化；请在日志 tab 查看工具参数和执行前后状态。": "The tool ran, but the canvas did not change. Check the Log tab for the tool arguments and before/after state.",
    "不支持的画布操作类型": "Unsupported canvas operation type",
    "节点类型必须是 text、image、config、video 或 audio": "Node type must be text, image, config, video, or audio",
    "画布操作已执行。": "Canvas operation executed.",
    "画布操作": "Canvas operation",
    "已完成": "Completed",
    "工具调用完成": "Tool call completed",
} as const;

const canvasAgentTitleZhToEn = {
    "确认工具调用": "Confirm tool call",
    "工具执行完成": "Tool execution completed",
    "工具执行失败": "Tool execution failed",
    "已拒绝执行": "Execution rejected",
    "拒绝执行": "Execution rejected",
    "操作失败": "Operation failed",
    "错误": "Error",
    "工具失败": "Tool failed",
    "发送请求": "Request sent",
    "模型工具回复": "Model tool response",
    "等待用户确认": "Waiting for confirmation",
    "工具执行结果": "Tool results",
    "Agent Tool Loop 达到步数上限": "Agent Tool Loop reached its step limit",
    "批准工具": "Tools approved",
    "工具续跑失败": "Tool continuation failed",
    "拒绝工具": "Tools rejected",
    "请求失败": "Request failed",
    "读取历史失败": "Failed to load history",
    "新建对话失败": "Failed to create conversation",
    "恢复对话失败": "Failed to resume conversation",
    "删除对话失败": "Failed to delete conversation",
    "用户发送": "User sent",
    "本地 Agent 已接收": "Local Agent received the request",
    "发送失败": "Send failed",
    "日志": "Log",
    "连接断开": "Disconnected",
    "连接失败": "Connection failed",
    "等待确认": "Waiting for confirmation",
    "已创建 Codex 会话": "Codex conversation created",
    "开始处理": "Started processing",
    "本轮完成": "Turn completed",
    "流式摘要": "Streaming summary",
    "本轮失败": "Turn failed",
    "Codex 回复": "Codex response",
    "Codex 事件": "Codex event",
    "画布操作完成": "Canvas operation completed",
    "读取画布完成": "Read canvas completed",
    "读取选区完成": "Read selection completed",
    "导出快照完成": "Export snapshot completed",
} as const;

const canvasAgentToolLabels = [
    ["canvas_apply_ops", "画布操作", "Canvas operation"],
    ["canvas_get_state", "读取画布", "Read canvas"],
    ["canvas_get_selection", "读取选区", "Read selection"],
    ["canvas_export_snapshot", "导出快照", "Export snapshot"],
    ["canvas_create_node", "创建节点", "Create node"],
    ["canvas_create_text_node", "创建文本", "Create text"],
    ["canvas_create_text_nodes", "批量创建文本", "Create text nodes"],
    ["canvas_create_config_node", "创建生成配置", "Create generation settings"],
    ["canvas_create_image_prompt_flow", "创建生图流程", "Create image flow"],
    ["canvas_create_generation_flow", "创建生成流程", "Create generation flow"],
    ["canvas_generate_text", "生成文本", "Generate text"],
    ["canvas_generate_image", "生成图片", "Generate image"],
    ["canvas_generate_video", "生成视频", "Generate video"],
    ["canvas_generate_audio", "生成音频", "Generate audio"],
    ["canvas_update_node", "更新节点", "Update node"],
    ["canvas_update_node_text", "更新文本", "Update text"],
    ["canvas_move_nodes", "移动节点", "Move nodes"],
    ["canvas_resize_node", "调整节点尺寸", "Resize node"],
    ["canvas_delete_nodes", "删除节点", "Delete nodes"],
    ["canvas_connect_nodes", "连接节点", "Connect nodes"],
    ["canvas_select_nodes", "选择节点", "Select nodes"],
    ["canvas_set_viewport", "调整视口", "Adjust viewport"],
    ["canvas_run_generation", "触发生成", "Start generation"],
] as const;

const canvasAgentOpLabels = {
    add_node: ["新增节点", "Add node"],
    update_node: ["更新节点", "Update node"],
    delete_node: ["删除节点", "Delete node"],
    delete_connections: ["删除连线", "Delete connection"],
    connect_nodes: ["连接", "Connect nodes"],
    set_viewport: ["调整视图", "Adjust view"],
    select_nodes: ["选择节点", "Select node"],
    run_generation: ["触发生成", "Start generation"],
} as const;

const canvasAgentAppTextEnToZh = reversePairs(canvasAgentAppTextZhToEn);
const canvasAgentTitleEnToZh = reversePairs(canvasAgentTitleZhToEn);

export function canvasText(zh: string, en: string, language: LanguageName = useLanguageStore.getState().language) {
    return language === "en" ? en : zh;
}

export function canvasAgentOpLabel(type: string, language: LanguageName = useLanguageStore.getState().language) {
    const pair = canvasAgentOpLabels[type as keyof typeof canvasAgentOpLabels];
    return pair ? pair[language === "en" ? 1 : 0] : type;
}

export function canvasAgentToolLabel(name: string, language: LanguageName = useLanguageStore.getState().language) {
    const pair = canvasAgentToolLabels.find(([id]) => id === name);
    return pair ? pair[language === "en" ? 2 : 1] : name;
}

/** Localizes application-owned Agent titles. The suffix of unknown tool names is preserved verbatim. */
export function canvasAgentTitleText(value: string, language: LanguageName = useLanguageStore.getState().language) {
    const exact = language === "en"
        ? canvasAgentTitleZhToEn[value as keyof typeof canvasAgentTitleZhToEn]
        : canvasAgentTitleEnToZh.get(value);
    if (exact) return exact;

    const toolLabel = localizeAgentToolLabel(value, language);
    if (toolLabel) return toolLabel;

    const loop = language === "en"
        ? value.match(/^Agent Tool Loop (\d+) (开始|结束|回复)$/u)
        : value.match(/^Agent Tool Loop (\d+) (started|finished|response)$/u);
    if (loop) {
        const phase = language === "en"
            ? ({ 开始: "started", 结束: "finished", 回复: "response" } as const)[loop[2] as "开始" | "结束" | "回复"]
            : ({ started: "开始", finished: "结束", response: "回复" } as const)[loop[2] as "started" | "finished" | "response"];
        return `Agent Tool Loop ${loop[1]} ${phase}`;
    }

    const dynamicToolTitle = localizeDynamicToolTitle(value, language);
    return dynamicToolTitle || value;
}

/** Localizes exact application-owned canvas messages while preserving unknown upstream text. */
export function canvasErrorText(value: string, language: LanguageName = useLanguageStore.getState().language) {
    if (language === "en") return canvasZhToEn[value as keyof typeof canvasZhToEn] ?? workbenchErrorText(value, language);
    return canvasEnToZh.get(value) ?? workbenchErrorText(value, language);
}

/** Localizes Canvas Agent-owned errors and leaves Codex, OS, and other upstream messages unchanged. */
export function canvasAgentErrorText(value: string, language: LanguageName = useLanguageStore.getState().language) {
    const appText = localizeAgentAppText(value, language);
    if (appText) return appText;
    if (language === "en") {
        const exact = canvasAgentErrorZhToEn[value as keyof typeof canvasAgentErrorZhToEn];
        if (exact) return exact;
        for (const [zhPrefix, enPrefix] of Object.entries(canvasAgentErrorPrefixZhToEn)) {
            if (!value.startsWith(zhPrefix)) continue;
            const suffix = value.slice(zhPrefix.length);
            return `${enPrefix}${suffix === "未命名图片" ? "Untitled image" : suffix}`;
        }
        return value;
    }
    const exact = canvasAgentErrorEnToZh.get(value);
    if (exact) return exact;
    for (const [zhPrefix, enPrefix] of Object.entries(canvasAgentErrorPrefixZhToEn)) {
        if (!value.startsWith(enPrefix)) continue;
        const suffix = value.slice(enPrefix.length);
        return `${zhPrefix}${suffix === "Untitled image" ? "未命名图片" : suffix}`;
    }
    return value;
}

/** Localizes recognized tool summaries while leaving arbitrary tool/upstream output untouched. */
export function canvasAgentToolText(value: string, language: LanguageName = useLanguageStore.getState().language) {
    return localizeAgentAppText(value, language) || canvasAgentErrorText(value, language);
}

function localizeAgentAppText(value: string, language: LanguageName) {
    const exact = language === "en"
        ? canvasAgentAppTextZhToEn[value as keyof typeof canvasAgentAppTextZhToEn]
        : canvasAgentAppTextEnToZh.get(value);
    if (exact) return exact;

    const opSummary = localizeAgentOpSummary(value, language);
    if (opSummary) return opSummary;
    const toolList = localizeAgentToolList(value, language);
    if (toolList) return toolList;

    let match = language === "en"
        ? value.match(/^当前选中 (\d+) 个节点。$/u)
        : value.match(/^Currently selected: (\d+) nodes?\.$/u);
    if (match) return language === "en" ? `Currently selected: ${match[1]} node${match[1] === "1" ? "" : "s"}.` : `当前选中 ${match[1]} 个节点。`;

    match = language === "en"
        ? value.match(/^读取到 (\d+) 个节点，(\d+) 条连线$/u)
        : value.match(/^Read (\d+) nodes? and (\d+) connections?$/u);
    if (match) return language === "en" ? `Read ${match[1]} node${match[1] === "1" ? "" : "s"} and ${match[2]} connection${match[2] === "1" ? "" : "s"}` : `读取到 ${match[1]} 个节点，${match[2]} 条连线`;

    match = language === "en"
        ? value.match(/^当前画布有 (\d+) 个节点、(\d+) 条连线。文本 (\d+) 个，图片 (\d+) 个，生成配置 (\d+) 个，视频 (\d+) 个，音频 (\d+) 个。$/u)
        : value.match(/^The current canvas has (\d+) nodes? and (\d+) connections?\. Text: (\d+), images: (\d+), generation configs: (\d+), videos: (\d+), audio: (\d+)\.$/u);
    if (match) {
        return language === "en"
            ? `The current canvas has ${match[1]} node${match[1] === "1" ? "" : "s"} and ${match[2]} connection${match[2] === "1" ? "" : "s"}. Text: ${match[3]}, images: ${match[4]}, generation configs: ${match[5]}, videos: ${match[6]}, audio: ${match[7]}.`
            : `当前画布有 ${match[1]} 个节点、${match[2]} 条连线。文本 ${match[3]} 个，图片 ${match[4]} 个，生成配置 ${match[5]} 个，视频 ${match[6]} 个，音频 ${match[7]} 个。`;
    }

    const validationPairs = [
        ["必须是字符串数组", "must be an array of strings"],
        ["必须只包含非空字符串", "must contain only non-empty strings"],
        ["必须是数组", "must be an array"],
        ["必须只包含对象", "must contain only objects"],
        ["必须是非空字符串", "must be a non-empty string"],
        ["必须是数字", "must be a number"],
    ] as const;
    for (const [zhSuffix, enSuffix] of validationPairs) {
        const sourceSuffix = language === "en" ? zhSuffix : enSuffix;
        if (!value.endsWith(` ${sourceSuffix}`)) continue;
        const field = value.slice(0, -sourceSuffix.length - 1);
        if (!/^[A-Za-z0-9_.]+$/u.test(field)) return "";
        return `${field} ${language === "en" ? enSuffix : zhSuffix}`;
    }
    return "";
}

function localizeAgentOpSummary(value: string, language: LanguageName) {
    const parts = value.split(/\s*(?:，|,)\s*/u);
    if (!parts.length) return "";
    const localized = parts.map((part) => {
        for (const [type, labels] of Object.entries(canvasAgentOpLabels)) {
            for (const label of labels) {
                const match = part.match(new RegExp(`^${escapeRegExp(label)}\\s+(\\d+)$`, "u"));
                if (match) return `${canvasAgentOpLabel(type, language)} ${match[1]}`;
            }
        }
        return "";
    });
    return localized.every(Boolean) ? localized.join(language === "en" ? ", " : "，") : "";
}

function localizeAgentToolList(value: string, language: LanguageName) {
    const parts = value.split(/\s*(?:，|,)\s*/u);
    if (!parts.length) return "";
    const localized = parts.map((part) => localizeAgentToolLabel(part, language));
    return localized.every(Boolean) ? localized.join(language === "en" ? ", " : "，") : "";
}

function localizeAgentToolLabel(value: string, language: LanguageName) {
    const pair = canvasAgentToolLabels.find(([, zh, en]) => value === zh || value === en);
    return pair ? pair[language === "en" ? 2 : 1] : "";
}

function localizeDynamicToolTitle(value: string, language: LanguageName) {
    const patterns = language === "en"
        ? [
            [/^调用工具：(.+)$/u, "Calling tool: "],
            [/^工具完成：(.+)$/u, "Tool completed: "],
            [/^(.+)完成$/u, "__completed__"],
        ] as const
        : [
            [/^Calling tool: (.+)$/u, "调用工具："],
            [/^Tool completed: (.+)$/u, "工具完成："],
            [/^(.+) completed$/u, "__completed__"],
        ] as const;
    for (const [pattern, prefix] of patterns) {
        const match = value.match(pattern);
        if (!match) continue;
        const knownLabel = localizeAgentToolLabel(match[1], language);
        if (prefix === "__completed__") return knownLabel ? (language === "en" ? `${knownLabel} completed` : `${knownLabel}完成`) : "";
        return `${prefix}${knownLabel || match[1]}`;
    }
    return "";
}

function reversePairs(value: Record<string, string>) {
    return new Map<string, string>(Object.entries(value).map(([zh, en]) => [en, zh]));
}

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
