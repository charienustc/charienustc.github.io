import {
  BarChart,
  Callout,
  ChartComparisonGrid,
  ChartContainer,
  H1,
  LineChart,
  MetricsGrid,
  PieChart,
  ReportSection,
  ReportShell,
  Stack,
  Table,
  Text,
  type MetricItem,
} from "qoder/canvas";

// —— 报告数据契约（由 scripts/lib/breakdown.mjs 产出，plugin 注入）——
interface CatRow {
  key: string;
  label: string;
  tokens: number;
  share: number;
}
interface ToolRow {
  tool: string;
  tokens: number;
  calls: number;
  /** 平均每次调用带来的重发 token；无调用记录时 null（不给 0） */
  perCall?: number | null;
  share: number;
}
interface FileRow {
  attr: string;
  label: string;
  kind: string;
  tool: string | null;
  selfTokens: number;
  reads: number;
  trips: number;
  billed: number;
  /** 单次读取的总代价（含此后每一程重发）；reads=0 时 null */
  perRead?: number | null;
  share: number;
}
interface ReqRow {
  index: number;
  time: string | null;
  ratio: number;
  inputTokens: number;
  /** 代理或转录任一有真值即非 null；两者都没则 null（不写 0） */
  outputTokens?: number | null;
  /** proxy=代理实测 / transcript-tokens=转录 input_tokens / transcript-ratio=转录 ratio×window */
  usageSource?: "proxy" | "transcript-tokens" | "transcript-ratio" | "transcript";
  credits: number;
  originalCredits: number;
  afterCompact: boolean;
}
interface CatChild {
  tool: string | null;
  label: string;
  kind: string | null;
  tokens: number;
  share: number;
  catShare: number;
  trips: number;
}
interface CatDetail {
  key: string;
  label: string;
  tokens: number;
  share: number;
  children: CatChild[];
}
interface SubagentRow {
  agentId: string;
  agentType: string | null;
  description: string | null;
  toolUseId: string | null;
  roundTrips: number;
  billedInputTokens: number;
  peakContextRatio: number;
  credits: number;
  originalCredits: number;
  error: string | null;
}
interface SubagentTotals {
  roundTrips: number;
  billedInputTokens: number;
  credits: number;
  originalCredits: number;
}
interface Subagents {
  scanned: boolean;
  dir: string | null;
  /** 试过的候选目录；用于区分「真没子代理」与「路径没找对」。 */
  probedPaths?: string[];
  /** ok=已汇总 / no-dir=无子代理目录 / dir-empty=目录在但无 agent 文件 / no-usage=有文件但转录无 usage / error=读取抛错 */
  reason?: string;
  count: number;
  items: SubagentRow[];
  totals: SubagentTotals;
  combined: SubagentTotals;
}
/** 逐项可用性：报告里每个数字到底是模型上报的真值、按真值推导、回退默认、手工录入，还是本地根本没有。
 *  v2 旧报告没这个对象，故全部字段可选，读取时一律走默认值（旧报告只可能来自桌面端富转录）。 */
type Avail = "measured" | "derived" | "fallback" | "manual" | "unavailable";
interface Availability {
  credits?: Avail;
  roundTrips?: Avail;
  contextRatio?: Avail;
  tokens?: Avail;
  /** 输出 token：代理或转录 output_tokens 任一有真值即 measured */
  outputTokens?: Avail;
  /** 缓存命中 token：代理或转录 cache_read_input_tokens 任一有真值即 measured */
  cachedTokens?: Avail;
  categoryShare?: Avail;
  toolShare?: Avail;
  fileShare?: Avail;
  systemPrompt?: Avail;
  contextWindow?: Avail;
  compactions?: Avail;
  compactionCost?: Avail;
  model?: Avail;
  title?: Avail;
  toolCalls?: Avail;
  fileReads?: Avail;
  userTurns?: Avail;
  /** 用户压缩阈值：manual 覆盖 → manual；默认 200K → fallback */
  userContextLimit?: Avail;
}
/** 官方 UI 真值（手工录入，来自 .qoder-credits/overrides/<sessionId>.json）。
 *  IDE 端转录不含 usage，本地算不出 Credits，这是唯一的真值通道；绝不覆盖 totals，只并列展示。 */
interface ManualTruth {
  file?: string;
  credits: number | null;
  originalCredits: number | null;
  model: string | null;
  startedAt: string | null;
  endedAt: string | null;
  durationMin: number | null;
  note: string | null;
  /** 手工锁定模型窗口（如 qwen3-max=1000000），优先于 runtime-config / 反推 / fallback */
  contextWindow?: number | null;
  /** 手工指定 Qoder 压缩触发阈值（默认 200000），驱动 peakUserAdvice */
  userContextLimit?: number | null;
  /** 本地 credits ÷ 官方真值。有子代理时拿 combined 比（官方 UI 扣费 = 主链 + 子代理），
   *  否则覆盖率会被系统性低估（实测 ca2f7834：主链比 0.46、combined 比 0.89）。 */
  localCoverage?: number | null;
  /** main=只比主链 / combined=比主链+子代理 */
  localScope?: "main" | "combined";
  /** 参与对账的本地 credits（按 localScope 取 totals.credits 或 subagents.combined.credits） */
  localCredits?: number | null;
}
/** 峰值占比的「该不该压」结论。阈值算在数据层（breakdown.mjs peakAdvice），
 *  这里只管展示——否则 Canvas 与终端各持一套阈值迟早走偏。tone 直接喂 Callout。 */
interface PeakAdvice {
  level: "low" | "mid" | "sweet" | "high" | "over";
  tone: "info" | "success" | "warning" | "danger";
  text: string;
}
/** 一次压缩 = 一笔普通模型调用（整份上下文当 prompt、摘要当 completion），是会话里单笔最贵的开销。
 *  pre/post 是客户端自估口径；proxy 是能在代理日志里唯一对上时回填的供应商实测值，对不上就 null。 */
interface CompactionEvent {
  index: number;
  at: string | null;
  trigger: string | null;
  preTokens: number | null;
  postTokens: number | null;
  messagesSummarized: number | null;
  /** 压缩后首轮的往返序号与实测输入 = 压缩把上下文压到的地板 */
  nextRequestIndex: number | null;
  nextInputTokens: number | null;
  savedTokens: number | null;
  /** 数据层归一后的生效值：有代理实测就用实测，否则是客户端自估。
   *  渲染端直接取这两个，别自己按 proxy 分支——否则会与合计的口径分叉。 */
  effectiveInputTokens?: number | null;
  effectiveOutputTokens?: number | null;
  proxy?: {
    promptTokens: number;
    completionTokens: number;
    cachedTokens: number | null;
    ms: number | null;
    matchedBy: string;
  } | null;
}
interface CompactionCost {
  count: number;
  items: CompactionEvent[];
  /** measured = items 里有几笔拿到了供应商实测（其余为客户端自估） */
  totals: { preTokens: number; postTokens: number; savedTokens: number; measured?: number };
}
/** 链路健康度：代理覆盖率 + 最近记录时间 + 最近若干笔的三方归因计数。
 *  逐笔明细属于排障（CLI --request-log），报告只给一行结论。 */
interface LinkHealth {
  matched: number;
  requests: number;
  coverage: number;
  /** proxy / transcript-tokens / transcript-ratio / mixed / transcript（v3 旧报告）/ null */
  usageSource?: "proxy" | "transcript-tokens" | "transcript-ratio" | "mixed" | "transcript" | null;
  /** 三档拆分：代理实测 / 转录 input_tokens / 转录 ratio×window */
  breakdown?: { proxy: number; transcriptTokens: number; transcriptRatio: number };
  logRecords?: number;
  lastRecordAt?: string | null;
  /** 参与归因的最近笔数；0 = 运行中的代理是旧版或还没记到诊断 */
  recentRequests?: number;
  proxyErrors?: number | null;
  upstreamRejected?: number | null;
  aborted?: number | null;
  truncated?: number | null;
  noUsage?: number | null;
  slowestMs?: number | null;
  /** 被更新流量推翻的那条陈旧拉起失败记录；null = 没有 */
  supersededFailure?: { error: string; port?: number; at?: string | null } | null;
}
interface Report {
  schemaVersion: number;
  generatedAt: string;
  pluginVersion?: string;
  /** 转录来自哪一代客户端：桌面端富转录有 usage 真值，IDE 端精简转录没有。v2 旧报告无此字段。 */
  source?: "desktop-rich" | "ide-lite" | "unknown";
  /** usage 数字的来源：proxy=代理实测 / transcript-tokens=转录 input_tokens 真值 /
   *  transcript-ratio=转录 ratio×window 推导 / mixed=多档混合 / transcript=v3 旧报告兼容。无 usage 时 null。 */
  usageSource?: "proxy" | "transcript-tokens" | "transcript-ratio" | "mixed" | "transcript" | null;
  /** 可直接粘贴执行的插件入口命令（generate.mjs 用 proxy.mjs 的 selfCmd() 注入）。
   *  Windows 上是插件自带启动器的绝对路径，不要求用户装 Node；模板是静态文本，拿不到就只能硬编码。 */
  selfCmd?: string | null;
  /** 链路健康度一行结论（逐笔明细留给 CLI --request-log） */
  linkHealth?: LinkHealth | null;
  /** 代理 join 诊断（lib/proxylog.mjs）+ 配置/状态（generate.mjs 注入） */
  proxy?: {
    matched: number;
    requests: number;
    /** 三档拆分：代理实测 / 转录 input_tokens / 转录 ratio×window */
    breakdown?: { proxy: number; transcriptTokens: number; transcriptRatio: number };
    logPath?: string;
    logExists?: boolean;
    logRecords?: number;
    /** config.json 里 upstream 合法 = 用户已配置代理 */
    configured?: boolean;
    enabled?: boolean;
    port?: number;
    /** 最近一条代理记录的时间；null = 从无流量 */
    lastRecordAt?: string | null;
    /** 已配置但长期零流量（多半已改回官方模型）——软提示可 --stop-proxy */
    dormant?: boolean;
    /** 最近一次自动拉起失败（如端口被占）；ok 时为 null */
    status?: { error: string; port?: number; at?: string | null } | null;
    /** status 那条失败记录是否已被更新的流量推翻（代理在它之后还记到了流量）。
     *  status.json 只写不清，陈旧失败会把用户推去改本来正确的 Base URL，故必须判掉。 */
    statusSuperseded?: boolean;
  };
  availability?: Availability;
  manual?: ManualTruth | null;
  session: {
    id: string | null;
    title: string | null;
    /** custom-title / first-user / session-id —— 令产物文件名可解释 */
    titleSource?: string;
    model: string | null;
    /** runtime-config / manual / unavailable */
    modelSource?: string;
    cwd: string | null;
    turns: number;
    roundTrips: number;
    compactions: number;
    startedAt: string | null;
    endedAt: string | null;
  };
  context: {
    contextWindow: number;
    /** runtime-config=实测 / derived-from-usage=从 usage 反推 / manual=ManualTruth 手工锁定 /
     *  fallback=读不到静默回退 200000 / caller=调用方传入（旧枚举，兼容）。
     *  报告里每个 token 数字都要乘它，回退时必须标出来。 */
    contextWindowSource?: string;
    systemPromptTokens: number;
    netContextTokens: number;
    /** 峰值 = 当前窗口口径：自最近一次压缩起算，压缩边界处归零重新累积 */
    peakContextTokens: number;
    peakContextRatio: number;
    /** 本场历史峰值（跨压缩）；整场没压缩过时与上面相等 */
    peakSessionTokens?: number;
    peakSessionRatio?: number;
    /** 历史峰值是否值得单独交代（与当前窗口峰值相差 ≥1 个百分点），渲染端直接取用不再自判 */
    peakSessionNotable?: boolean;
    /** 峰值占比的「该不该压」结论（对模型窗口）；无有效占比时 null */
    peakAdvice?: PeakAdvice | null;
    /** 用户压缩阈值（Qoder 自动触发点），与模型窗口独立。默认 200000，ManualTruth 可覆盖 */
    userContextLimit?: number;
    /** default=内置 200K / manual=overrides 手写 / config=插件配置 / derived=实测反推 */
    userContextLimitSource?: "default" | "manual" | "config" | "derived";
    /** peakContextTokens ÷ userContextLimit */
    peakUserRatio?: number;
    /** 对用户阈值的「快自动压缩了吗」结论；与 peakAdvice 可矛盾（模型窗口未满但用户阈值已超） */
    peakUserAdvice?: PeakAdvice | null;
    /** v3.2 当前占用头条口径：段内单调递增 ⇒ 峰值≡当前，故以 netContextTokens 作头条，peak 退灰字 */
    currentContextTokens?: number;
    netUserRatio?: number;
    netUserAdvice?: PeakAdvice | null;
    netWindowRatio?: number;
    /** v3.2 自动压缩自校准：本场 trigger=auto 的实际触发点（无需外部配置）与「阈值是否被强制」判定 */
    observedAutoCompactions?: number;
    observedAutoTriggerTokens?: number | null;
    autoTriggerRatio?: number | null;
    thresholdNotEnforced?: boolean;
  };
  totals: {
    billedInputTokens: number;
    netContextTokens: number;
    peakContextTokens: number;
    amplification: number;
    attributedTokens: number;
    coverage: number;
    credits: number;
    originalCredits: number;
    /** 输出 token 总量：仅代理路径有真值，否则 0 且 availability.outputTokens=unavailable */
    outputTokens?: number;
    /** 供应商上下文缓存命中的那部分 prompt：仅代理路径有真值 */
    cachedTokens?: number;
    cachedTrips?: number;
    /** 缓存命中 ÷ 计费输入总量（全局实测约 91.5%：重复叠加的前缀正是缓存的命中对象） */
    cachedShare?: number;
    /** 两个不依赖 usage 的计数，IDE 端占比全缺时仍有可展示的真值 */
    toolCalls?: number;
    fileReads?: number;
  };
  /** credits 的分子到底覆盖了多少：与计费输入总量并排展示时，部分覆盖不说就等于把局部真值当全量。 */
  creditsCoverage?: {
    /** 真正累加进 totals.credits 的往返数 */
    trips: number;
    roundTrips: number;
    /** 这些往返的计费输入之和 */
    tokens: number;
    tokenShare: number;
    /** trips === roundTrips：全覆盖时不必再啰嗦覆盖范围 */
    full: boolean;
  };
  /** 压缩单笔成本（此前只显示「压缩 N 次」，而它是会话里单笔最贵的调用） */
  compactionCost?: CompactionCost;
  byCategory: CatRow[];
  byCategoryDetail: CatDetail[];
  byTool: ToolRow[];
  byFile: FileRow[];
  byRequest: ReqRow[];
  subagents?: Subagents;
  identity: { sumAttributed: number; billedInputTokens: number; absDiff: number; ok: boolean | null };
}

// 注入点：下一行的 REPORT 初值会被 render-canvas.mjs 按整行替换为真实报告 JSON。
const REPORT = {"schemaVersion":3.2,"generatedAt":"2026-09-22T09:49:15.781Z","source":"desktop-rich","usageSource":"transcript-ratio","availability":{"credits":"measured","roundTrips":"measured","contextRatio":"measured","tokens":"derived","outputTokens":"unavailable","cachedTokens":"unavailable","categoryShare":"derived","toolShare":"derived","fileShare":"derived","systemPrompt":"derived","contextWindow":"measured","compactions":"measured","compactionCost":"measured","model":"measured","title":"measured","toolCalls":"measured","fileReads":"measured","userTurns":"measured","userContextLimit":"fallback"},"session":{"id":"539a8c3a-c70a-406b-adfe-50c1b6449066","title":"当前工作区是我的个人主页，但是现在的设计和交互逻","titleSource":"first-user","model":"auto","modelSource":"runtime-config","cwd":"F:\\myhomepage","turns":29,"roundTrips":212,"compactions":1,"startedAt":"2026-09-22T07:07:40.093Z","endedAt":"2026-09-22T09:49:15.490Z"},"context":{"contextWindow":128000,"contextWindowSource":"runtime-config","systemPromptTokens":10342,"netContextTokens":80949,"peakContextTokens":80949,"peakContextRatio":0.6324140625,"peakSessionTokens":80949,"peakSessionRatio":0.6324140625,"peakSessionNotable":false,"peakAdvice":{"level":"mid","tone":"info","text":"已过盈亏线（39%）但还没进性价比区间，压缩有净收益但不大；不急着压"},"userContextLimit":200000,"userContextLimitSource":"default","peakUserRatio":0.404745,"peakUserAdvice":{"level":"mid","tone":"info","text":"已过盈亏线（39%）但还没进性价比区间，压缩有净收益但不大；不急着压"},"currentContextTokens":80949,"netUserRatio":0.404745,"netUserAdvice":{"level":"mid","tone":"info","text":"已过盈亏线（39%）但还没进性价比区间，压缩有净收益但不大；不急着压"},"netWindowRatio":0.6324140625,"observedAutoCompactions":1,"observedAutoTriggerTokens":192629,"autoTriggerRatio":1.5049140625,"thresholdNotEnforced":false},"totals":{"billedInputTokens":7963862,"netContextTokens":80949,"peakContextTokens":80949,"amplification":98.38,"attributedTokens":7963862,"coverage":1,"credits":1378.764,"originalCredits":1378.764,"outputTokens":0,"cachedTokens":0,"cachedTrips":0,"cachedShare":0,"toolCalls":256,"fileReads":93},"creditsCoverage":{"trips":212,"roundTrips":212,"tokens":7963862,"tokenShare":1.0000000492223495,"full":true},"compactionCost":{"count":1,"items":[{"index":1,"at":"2026-09-22T09:33:20.470Z","trigger":"auto","preTokens":192629,"postTokens":3185,"messagesSummarized":650,"nextRequestIndex":157,"nextInputTokens":38291,"savedTokens":154338,"proxy":null,"effectiveInputTokens":192629,"effectiveOutputTokens":3185}],"totals":{"preTokens":192629,"postTokens":3185,"savedTokens":154338,"measured":0}},"proxy":{"matched":0,"requests":212,"breakdown":{"proxy":0,"transcriptTokens":0,"transcriptRatio":212},"logPath":"C:\\Users\\Charien\\.qoder-credits-proxy\\usage.jsonl","logExists":false,"logRecords":0,"configured":false,"enabled":true,"port":49787,"lastRecordAt":null,"dormant":false,"status":null,"statusSuperseded":false},"byCategory":[{"key":"tool_result","label":"工具返回","tokens":1708729,"share":0.21456033814589298},{"key":"system","label":"系统提示词","tokens":2192504,"share":0.27530662886925966},{"key":"compact_summary","label":"压缩摘要","tokens":233200,"share":0.029282280418754608},{"key":"assistant_thinking","label":"模型思考","tokens":602630,"share":0.07567057848777134},{"key":"assistant_tool_use","label":"工具调用","tokens":767224,"share":0.09633821355120524},{"key":"assistant_text","label":"模型回复","tokens":95431,"share":0.011982970992230219},{"key":"user_input","label":"用户输入","tokens":338824,"share":0.042545202060979906},{"key":"attachment","label":"附件/技能","tokens":2025320,"share":0.25431383669625696}],"byCategoryDetail":[{"key":"tool_result","label":"工具返回","tokens":1708729,"share":0.21456033814589298,"children":[{"tool":"Read","label":"src/styles/global.css","kind":"read","tokens":622104,"share":0.07811590762118321,"catShare":0.3640743125976401,"trips":222},{"tool":"Bash","label":"（无路径）","kind":"shell","tokens":264822,"share":0.03325301510728285,"catShare":0.1549821154955118,"trips":3698},{"tool":"Read","label":"src/components/Header.astro","kind":"read","tokens":236586,"share":0.029707437100403022,"catShare":0.13845726268478883,"trips":206},{"tool":"mcp_call","label":"（无路径）","kind":"other","tokens":84069,"share":0.010556322643117646,"catShare":0.049199785637640735,"trips":4301},{"tool":"Read","label":"src/components/Hero.astro","kind":"read","tokens":49256,"share":0.006184978449875662,"catShare":0.02882628962707035,"trips":151},{"tool":"Read","label":"src/pages/links.astro","kind":"read","tokens":40041,"share":0.005027866371549317,"catShare":0.023433344741144828,"trips":149},{"tool":"Read","label":"admin/public/index.html","kind":"read","tokens":36324,"share":0.004561163472368044,"catShare":0.021258185514541013,"trips":82},{"tool":"Read","label":"src/pages/blog/archive.astro","kind":"read","tokens":35342,"share":0.004437747980212089,"catShare":0.020682983717123838,"trips":148},{"tool":"Read","label":"src/pages/blog/[...id].astro","kind":"read","tokens":28895,"share":0.003628311805249935,"catShare":0.0169104496972913,"trips":148},{"tool":"Read","label":"src/components/ProjectCard.astro","kind":"read","tokens":27332,"share":0.0034320183544511527,"catShare":0.015995586062683722,"trips":150},{"tool":"Read","label":"src/components/BaseHead.astro","kind":"read","tokens":24720,"share":0.003104043904196439,"catShare":0.014466997633485298,"trips":150},{"tool":"Read","label":"src/pages/blog/index.astro","kind":"read","tokens":23621,"share":0.002966038008416836,"catShare":0.013823794434925067,"trips":149},{"tool":"Read","label":"src/pages/index.astro","kind":"read","tokens":20545,"share":0.0025797564025809056,"catShare":0.012023454217464776,"trips":153},{"tool":"Read","label":"src/pages/blog/tags/index.astro","kind":"read","tokens":19861,"share":0.0024938943769505302,"catShare":0.011623277622049493,"trips":137},{"tool":"Read","label":"src/pages/blog/tags/[tag].astro","kind":"read","tokens":19532,"share":0.0024525591110342248,"catShare":0.011430626611739289,"trips":137},{"tool":null,"label":"其他 60 项","kind":null,"tokens":175677,"share":0.022059277437019548,"catShare":0.10281153370489221,"trips":10276}]},{"key":"system","label":"系统提示词","tokens":2192504,"share":0.27530662886925966,"children":[]},{"key":"compact_summary","label":"压缩摘要","tokens":233200,"share":0.029282280418754608,"children":[]},{"key":"assistant_thinking","label":"模型思考","tokens":602630,"share":0.07567057848777134,"children":[]},{"key":"assistant_tool_use","label":"工具调用","tokens":767224,"share":0.09633821355120524,"children":[{"tool":"Write","label":"src/styles/global.css","kind":"write","tokens":105260,"share":0.013217174756689902,"catShare":0.13719555583895868,"trips":145},{"tool":"Edit","label":"src/styles/global.css","kind":"write","tokens":104793,"share":0.01315852520297888,"catShare":0.13658676778332537,"trips":343},{"tool":"mcp_call","label":"（无路径）","kind":"other","tokens":54983,"share":0.006904044345217646,"catShare":0.07166464989044083,"trips":4301},{"tool":"Bash","label":"（无路径）","kind":"shell","tokens":49853,"share":0.006259894741357021,"catShare":0.06497831452967302,"trips":3698},{"tool":"Write","label":"admin/public/index.html","kind":"write","tokens":41692,"share":0.005235117176963632,"catShare":0.05434102402346382,"trips":79},{"tool":"Write","label":"src/components/Header.astro","kind":"write","tokens":30613,"share":0.0038439400179054715,"catShare":0.03990047018945767,"trips":142},{"tool":"Write","label":"src/pages/blog/[...id].astro","kind":"write","tokens":29065,"share":0.003649631134803573,"catShare":0.03788352513785963,"trips":135},{"tool":"AskUserQuestion","label":"（无路径）","kind":"other","tokens":28740,"share":0.0036088300420436567,"catShare":0.037460005837927524,"trips":165},{"tool":"TaskCreate","label":"（无路径）","kind":"other","tokens":28572,"share":0.0035876614072683716,"catShare":0.03724027335592511,"trips":963},{"tool":"Write","label":"src/pages/blog/archive.astro","kind":"write","tokens":24968,"share":0.0031351650591746314,"catShare":0.03254331737746251,"trips":135},{"tool":"Write","label":"src/components/ProjectCard.astro","kind":"write","tokens":20626,"share":0.0025899050737641,"catShare":0.02688346584699254,"trips":139},{"tool":"Write","label":"src/pages/blog/tags/index.astro","kind":"write","tokens":17708,"share":0.002223590783699808,"catShare":0.0230810879892218,"trips":134},{"tool":"Write","label":"src/pages/blog/tags/[tag].astro","kind":"write","tokens":14797,"share":0.0018580100939232442,"catShare":0.019286324973585726,"trips":134},{"tool":"Write","label":"src/pages/blog/index.astro","kind":"write","tokens":14283,"share":0.001793480956548604,"catShare":0.018616506269294078,"trips":136},{"tool":"Write","label":"src/pages/index.astro","kind":"write","tokens":14268,"share":0.00179159465933621,"catShare":0.018596926321287347,"trips":138},{"tool":null,"label":"其他 60 项","kind":null,"tokens":187005,"share":0.023481648099531283,"catShare":0.24374178463513266,"trips":9470}]},{"key":"assistant_text","label":"模型回复","tokens":95431,"share":0.011982970992230219,"children":[]},{"key":"user_input","label":"用户输入","tokens":338824,"share":0.042545202060979906,"children":[]},{"key":"attachment","label":"附件/技能","tokens":2025320,"share":0.25431383669625696,"children":[]}],"byTool":[{"tool":"Read","tokens":1308177,"calls":30,"perCall":43606,"share":0.16426418414393204},{"tool":"Write","tokens":439175,"calls":27,"perCall":16266,"share":0.055146003858814296},{"tool":"Bash","tokens":314675,"calls":73,"perCall":4311,"share":0.03951290984863982},{"tool":"Edit","tokens":165013,"calls":34,"perCall":4853,"share":0.020720234167492208},{"tool":"mcp_call","tokens":139052,"calls":61,"perCall":2280,"share":0.017460366988335252},{"tool":"TaskCreate","tokens":35138,"calls":7,"perCall":5020,"share":0.0044121989801700935},{"tool":"AskUserQuestion","tokens":33228,"calls":2,"perCall":16614,"share":0.004172401085887643},{"tool":"Grep","tokens":21043,"calls":2,"perCall":10522,"share":0.0026423720641354405},{"tool":"WebFetch","tokens":12343,"calls":3,"perCall":4114,"share":0.0015499271145106317},{"tool":"TaskUpdate","tokens":6512,"calls":14,"perCall":465,"share":0.0008176506613254048},{"tool":"TaskStop","tokens":935,"calls":2,"perCall":468,"share":0.00011743505834546082},{"tool":"Skill","tokens":660,"calls":1,"perCall":660,"share":0.00008286772550879842}],"byFile":[{"attr":"file:F:\\myhomepage\\src\\styles\\global.css","label":"src/styles/global.css","kind":"read","tool":"Read","selfTokens":19175,"reads":14,"trips":1420,"billed":842325,"perRead":60166,"share":0.10576842225258179},{"attr":"file:F:\\myhomepage\\src\\components\\Header.astro","label":"src/components/Header.astro","kind":"read","tool":"Read","selfTokens":5605,"reads":4,"trips":830,"billed":271185,"perRead":67796,"share":0.03405197519519688},{"attr":"file:F:\\myhomepage\\admin\\public\\index.html","label":"admin/public/index.html","kind":"read","tool":"Read","selfTokens":12917,"reads":3,"trips":414,"billed":79380,"perRead":26460,"share":0.00996755747851152},{"attr":"file:F:\\myhomepage\\src\\components\\Hero.astro","label":"src/components/Hero.astro","kind":"read","tool":"Read","selfTokens":1763,"reads":4,"trips":996,"billed":66605,"perRead":16651,"share":0.008363419871001355},{"attr":"file:F:\\myhomepage\\src\\pages\\blog\\archive.astro","label":"src/pages/blog/archive.astro","kind":"read","tool":"Read","selfTokens":1534,"reads":2,"trips":566,"billed":61766,"perRead":30883,"share":0.007755819389553659},{"attr":"file:F:\\myhomepage\\src\\pages\\blog\\[...id].astro","label":"src/pages/blog/[...id].astro","kind":"read","tool":"Read","selfTokens":2555,"reads":6,"trips":744,"billed":61442,"perRead":10240,"share":0.0077151313552787405},{"attr":"file:F:\\myhomepage\\src\\pages\\links.astro","label":"src/pages/links.astro","kind":"read","tool":"Read","selfTokens":1754,"reads":4,"trips":896,"billed":60041,"perRead":15010,"share":0.007539120348989964},{"attr":"file:F:\\myhomepage\\src\\components\\ProjectCard.astro","label":"src/components/ProjectCard.astro","kind":"read","tool":"Read","selfTokens":1268,"reads":3,"trips":690,"billed":50063,"perRead":16688,"share":0.006286237788273791},{"attr":"file:F:\\myhomepage\\src\\components\\BaseHead.astro","label":"src/components/BaseHead.astro","kind":"read","tool":"Read","selfTokens":1076,"reads":4,"trips":950,"billed":40028,"perRead":10007,"share":0.005026155173781962},{"attr":"file:F:\\myhomepage\\src\\pages\\blog\\tags\\index.astro","label":"src/pages/blog/tags/index.astro","kind":"read","tool":"Read","selfTokens":1212,"reads":3,"trips":652,"billed":39431,"perRead":13144,"share":0.004951255324993231},{"attr":"file:F:\\myhomepage\\src\\pages\\blog\\index.astro","label":"src/pages/blog/index.astro","kind":"read","tool":"Read","selfTokens":949,"reads":2,"trips":570,"billed":39308,"perRead":19654,"share":0.00493580721633574},{"attr":"file:F:\\myhomepage\\src\\pages\\index.astro","label":"src/pages/index.astro","kind":"read","tool":"Read","selfTokens":964,"reads":3,"trips":678,"billed":36735,"perRead":12245,"share":0.004612680940785074},{"attr":"file:F:\\myhomepage\\src\\pages\\blog\\tags\\[tag].astro","label":"src/pages/blog/tags/[tag].astro","kind":"read","tool":"Read","selfTokens":1004,"reads":2,"trips":542,"billed":35670,"perRead":17835,"share":0.00447896686458732},{"attr":"file:F:\\myhomepage\\src\\components\\PostCard.astro","label":"src/components/PostCard.astro","kind":"read","tool":"Read","selfTokens":911,"reads":3,"trips":690,"billed":34164,"perRead":11388,"share":0.004289830629610297},{"attr":"file:F:\\myhomepage\\src\\pages\\portfolio\\index.astro","label":"src/pages/portfolio/index.astro","kind":"read","tool":"Read","selfTokens":749,"reads":2,"trips":564,"billed":30021,"perRead":15010,"share":0.0037696425447585045},{"attr":"file:F:\\myhomepage\\src\\layouts\\BaseLayout.astro","label":"src/layouts/BaseLayout.astro","kind":"read","tool":"Read","selfTokens":619,"reads":3,"trips":662,"billed":22698,"perRead":7566,"share":0.0028501417927618354},{"attr":"file:F:\\myhomepage\\src\\components\\Footer.astro","label":"src/components/Footer.astro","kind":"read","tool":"Read","selfTokens":490,"reads":2,"trips":584,"billed":21256,"perRead":10628,"share":0.0026690807354478006},{"attr":"file:F:\\myhomepage\\src","label":"src","kind":"search","tool":"Grep","selfTokens":623,"reads":1,"trips":264,"billed":20385,"perRead":20385,"share":0.002559699322800648},{"attr":"file:F:\\myhomepage\\src\\components\\Section.astro","label":"src/components/Section.astro","kind":"read","tool":"Read","selfTokens":708,"reads":4,"trips":790,"billed":15510,"perRead":3878,"share":0.0019475956543313093},{"attr":"file:F:\\myhomepage\\src\\components\\EmptyState.astro","label":"src/components/EmptyState.astro","kind":"read","tool":"Read","selfTokens":425,"reads":2,"trips":546,"billed":15395,"perRead":7697,"share":0.0019330546691355183},{"attr":"file:F:\\myhomepage\\admin\\server.mjs","label":"admin/server.mjs","kind":"read","tool":"Read","selfTokens":2266,"reads":1,"trips":164,"billed":14228,"perRead":14228,"share":0.0017866199530485723},{"attr":"file:F:\\myhomepage\\CLAUDE.md","label":"CLAUDE.md","kind":"write","tool":"Edit","selfTokens":986,"reads":4,"trips":848,"billed":12689,"perRead":3172,"share":0.0015933153010178403},{"attr":"file:F:\\myhomepage\\astro.config.mjs","label":"astro.config.mjs","kind":"read","tool":"Read","selfTokens":464,"reads":3,"trips":132,"billed":12118,"perRead":4039,"share":0.0015216795101868018},{"attr":"file:F:\\myhomepage\\src\\scripts\\reveal.ts","label":"src/scripts/reveal.ts","kind":"write","tool":"Write","selfTokens":264,"reads":1,"trips":282,"billed":10472,"perRead":10472,"share":0.0013149978538191114},{"attr":"file:F:\\myhomepage\\src\\content\\blog\\hello-world.md","label":"src/content/blog/hello-world.md","kind":"read","tool":"Read","selfTokens":3182,"reads":3,"trips":184,"billed":8518,"perRead":2839,"share":0.0010696427519301583},{"attr":"file:F:\\myhomepage\\src\\consts.ts","label":"src/consts.ts","kind":"read","tool":"Read","selfTokens":150,"reads":1,"trips":300,"billed":6996,"perRead":6996,"share":0.0008785029917537086},{"attr":"file:F:\\myhomepage\\src\\components\\PageHeader.astro","label":"src/components/PageHeader.astro","kind":"write","tool":"Write","selfTokens":158,"reads":1,"trips":272,"billed":5656,"perRead":5656,"share":0.0007102004790342843},{"attr":"file:F:\\myhomepage\\src\\components\\Card.astro","label":"src/components/Card.astro","kind":"read","tool":"Read","selfTokens":117,"reads":1,"trips":298,"billed":5366,"perRead":5366,"share":0.0006738377611354757},{"attr":"file:C:\\Users\\Charien\\.qoder-cn\\projects\\F--myhomepage\\memory\\homepage-design-direction.md","label":"C:/Users/Charien/.qoder-cn/projects/F--myhomepage/memory/homepage-design-direction.md","kind":"write","tool":"Write","selfTokens":397,"reads":1,"trips":208,"billed":4486,"perRead":4486,"share":0.000563262742068313},{"attr":"file:F:\\myhomepage\\src\\components\\Prose.astro","label":"src/components/Prose.astro","kind":"read","tool":"Read","selfTokens":62,"reads":1,"trips":298,"billed":2844,"perRead":2844,"share":0.00035707642043076497},{"attr":"file:F:\\myhomepage\\src\\components\\Tag.astro","label":"src/components/Tag.astro","kind":"read","tool":"Read","selfTokens":71,"reads":1,"trips":274,"billed":2597,"perRead":2597,"share":0.0003260893200064232},{"attr":"file:F:\\myhomepage\\src\\scripts\\code-copy.ts","label":"src/scripts/code-copy.ts","kind":"write","tool":"Write","selfTokens":450,"reads":1,"trips":80,"billed":1539,"perRead":1539,"share":0.00019326329877869495},{"attr":"file:C:\\Users\\Charien\\.qoder-cn\\projects\\F--myhomepage\\memory\\MEMORY.md","label":"C:/Users/Charien/.qoder-cn/projects/F--myhomepage/memory/MEMORY.md","kind":"write","tool":"Write","selfTokens":100,"reads":1,"trips":206,"billed":1054,"perRead":1054,"share":0.00013233119137809769},{"attr":"file:F:\\myhomepage\\src\\content.config.ts","label":"src/content.config.ts","kind":"read","tool":"Read","selfTokens":273,"reads":1,"trips":66,"billed":778,"perRead":778,"share":0.00009770736973427021},{"attr":"file:F:\\myhomepage","label":"F:/myhomepage","kind":"search","tool":"Grep","selfTokens":101,"reads":1,"trips":178,"billed":658,"perRead":658,"share":0.00008267274133478952}],"byAttr":[{"attr":"system","tokens":2192504,"share":0.27530662886925966},{"attr":"attachment","tokens":2025320,"share":0.25431383669625696},{"attr":"tool_result|Read","tokens":1289946,"share":0.16197492135538497},{"attr":"assistant_thinking","tokens":602630,"share":0.07567057848777134},{"attr":"tool_use|Write","tokens":423936,"share":0.053232444984584355},{"attr":"user_input","tokens":338824,"share":0.042545202060979906},{"attr":"tool_result|Bash","tokens":264822,"share":0.03325301510728285},{"attr":"compact_summary","tokens":233200,"share":0.029282280418754608},{"attr":"tool_use|Edit","tokens":149670,"share":0.018793675509355193},{"attr":"assistant_text","tokens":95431,"share":0.011982970992230219},{"attr":"tool_result|mcp_call","tokens":84069,"share":0.010556322643117646},{"attr":"tool_use|mcp_call","tokens":54983,"share":0.006904044345217646},{"attr":"tool_use|Bash","tokens":49853,"share":0.006259894741357021},{"attr":"tool_use|AskUserQuestion","tokens":28740,"share":0.0036088300420436567},{"attr":"tool_use|TaskCreate","tokens":28572,"share":0.0035876614072683716},{"attr":"tool_result|Grep","tokens":19363,"share":0.002431320634472368},{"attr":"tool_use|Read","tokens":18231,"share":0.002289262788547264},{"attr":"tool_result|Edit","tokens":15343,"share":0.0019265586581369495},{"attr":"tool_result|Write","tokens":15239,"share":0.0019135588742299117},{"attr":"tool_use|WebFetch","tokens":7231,"share":0.000907922612519212},{"attr":"tool_result|TaskCreate","tokens":6567,"share":0.0008245375729017231},{"attr":"tool_result|WebFetch","tokens":5113,"share":0.0006420045019914207},{"attr":"tool_result|AskUserQuestion","tokens":4488,"share":0.0005635710438439906},{"attr":"tool_use|TaskUpdate","tokens":3907,"share":0.0004905903967952441},{"attr":"tool_result|TaskUpdate","tokens":2605,"share":0.0003270602645301586},{"attr":"tool_use|Grep","tokens":1681,"share":0.00021105142966306944},{"attr":"tool_result|TaskStop","tokens":819,"share":0.00010284640703296155},{"attr":"tool_result|Skill","tokens":355,"share":0.000044621082966276094},{"attr":"tool_use|Skill","tokens":305,"share":0.000038246642542522355},{"attr":"tool_use|TaskStop","tokens":116,"share":0.000014588651312499339}],"byRequest":[{"index":1,"time":"15:07","ratio":0.115745,"inputTokens":14815,"outputTokens":null,"usageSource":"transcript-ratio","credits":4.99,"originalCredits":4.99,"afterCompact":false},{"index":2,"time":"15:08","ratio":0.1283,"inputTokens":16422,"outputTokens":null,"usageSource":"transcript-ratio","credits":2.746,"originalCredits":2.746,"afterCompact":false},{"index":3,"time":"15:08","ratio":0.136325,"inputTokens":17450,"outputTokens":null,"usageSource":"transcript-ratio","credits":2.802,"originalCredits":2.802,"afterCompact":false},{"index":4,"time":"15:08","ratio":0.17511,"inputTokens":22414,"outputTokens":null,"usageSource":"transcript-ratio","credits":6.712,"originalCredits":6.712,"afterCompact":false},{"index":5,"time":"15:10","ratio":0.17907,"inputTokens":22921,"outputTokens":null,"usageSource":"transcript-ratio","credits":4.127,"originalCredits":4.127,"afterCompact":false},{"index":6,"time":"15:10","ratio":0.21085,"inputTokens":26989,"outputTokens":null,"usageSource":"transcript-ratio","credits":5.422,"originalCredits":5.422,"afterCompact":false},{"index":7,"time":"15:10","ratio":0.224155,"inputTokens":28692,"outputTokens":null,"usageSource":"transcript-ratio","credits":3.924,"originalCredits":3.924,"afterCompact":false},{"index":8,"time":"15:10","ratio":0.238895,"inputTokens":30579,"outputTokens":null,"usageSource":"transcript-ratio","credits":4.185,"originalCredits":4.185,"afterCompact":false},{"index":9,"time":"15:12","ratio":0.251395,"inputTokens":32179,"outputTokens":null,"usageSource":"transcript-ratio","credits":8.173,"originalCredits":8.173,"afterCompact":false},{"index":10,"time":"15:12","ratio":0.26259,"inputTokens":33612,"outputTokens":null,"usageSource":"transcript-ratio","credits":5.119,"originalCredits":5.119,"afterCompact":false},{"index":11,"time":"15:13","ratio":0.26636,"inputTokens":34094,"outputTokens":null,"usageSource":"transcript-ratio","credits":9.731,"originalCredits":9.731,"afterCompact":false},{"index":12,"time":"15:14","ratio":0.281395,"inputTokens":36019,"outputTokens":null,"usageSource":"transcript-ratio","credits":6.066,"originalCredits":6.066,"afterCompact":false},{"index":13,"time":"15:14","ratio":0.286325,"inputTokens":36650,"outputTokens":null,"usageSource":"transcript-ratio","credits":3.951,"originalCredits":3.951,"afterCompact":false},{"index":14,"time":"15:15","ratio":0.28822,"inputTokens":36892,"outputTokens":null,"usageSource":"transcript-ratio","credits":5.039,"originalCredits":5.039,"afterCompact":false},{"index":15,"time":"15:15","ratio":0.29298,"inputTokens":37501,"outputTokens":null,"usageSource":"transcript-ratio","credits":5.325,"originalCredits":5.325,"afterCompact":false},{"index":16,"time":"15:16","ratio":0.298235,"inputTokens":38174,"outputTokens":null,"usageSource":"transcript-ratio","credits":6.286,"originalCredits":6.286,"afterCompact":false},{"index":17,"time":"15:17","ratio":0.304875,"inputTokens":39024,"outputTokens":null,"usageSource":"transcript-ratio","credits":7.525,"originalCredits":7.525,"afterCompact":false},{"index":18,"time":"15:17","ratio":0.314515,"inputTokens":40258,"outputTokens":null,"usageSource":"transcript-ratio","credits":4.81,"originalCredits":4.81,"afterCompact":false},{"index":19,"time":"15:17","ratio":0.316975,"inputTokens":40573,"outputTokens":null,"usageSource":"transcript-ratio","credits":4.016,"originalCredits":4.016,"afterCompact":false},{"index":20,"time":"15:18","ratio":0.3276,"inputTokens":41933,"outputTokens":null,"usageSource":"transcript-ratio","credits":6.673,"originalCredits":6.673,"afterCompact":false},{"index":21,"time":"15:19","ratio":0.3339,"inputTokens":42739,"outputTokens":null,"usageSource":"transcript-ratio","credits":7.61,"originalCredits":7.61,"afterCompact":false},{"index":22,"time":"15:19","ratio":0.34361,"inputTokens":43982,"outputTokens":null,"usageSource":"transcript-ratio","credits":6.599,"originalCredits":6.599,"afterCompact":false},{"index":23,"time":"15:20","ratio":0.349385,"inputTokens":44721,"outputTokens":null,"usageSource":"transcript-ratio","credits":5.676,"originalCredits":5.676,"afterCompact":false},{"index":24,"time":"15:20","ratio":0.35409,"inputTokens":45324,"outputTokens":null,"usageSource":"transcript-ratio","credits":4.442,"originalCredits":4.442,"afterCompact":false},{"index":25,"time":"15:20","ratio":0.359435,"inputTokens":46008,"outputTokens":null,"usageSource":"transcript-ratio","credits":4.245,"originalCredits":4.245,"afterCompact":false},{"index":26,"time":"15:21","ratio":0.361885,"inputTokens":46321,"outputTokens":null,"usageSource":"transcript-ratio","credits":3.983,"originalCredits":3.983,"afterCompact":false},{"index":27,"time":"15:22","ratio":0.363165,"inputTokens":46485,"outputTokens":null,"usageSource":"transcript-ratio","credits":3.777,"originalCredits":3.777,"afterCompact":false},{"index":28,"time":"15:22","ratio":0.36381,"inputTokens":46568,"outputTokens":null,"usageSource":"transcript-ratio","credits":3.863,"originalCredits":3.863,"afterCompact":false},{"index":29,"time":"15:22","ratio":0.365755,"inputTokens":46817,"outputTokens":null,"usageSource":"transcript-ratio","credits":3.86,"originalCredits":3.86,"afterCompact":false},{"index":30,"time":"15:23","ratio":0.366505,"inputTokens":46913,"outputTokens":null,"usageSource":"transcript-ratio","credits":3.708,"originalCredits":3.708,"afterCompact":false},{"index":31,"time":"15:23","ratio":0.36831,"inputTokens":47144,"outputTokens":null,"usageSource":"transcript-ratio","credits":4.257,"originalCredits":4.257,"afterCompact":false},{"index":32,"time":"15:24","ratio":0.375715,"inputTokens":48092,"outputTokens":null,"usageSource":"transcript-ratio","credits":5.055,"originalCredits":5.055,"afterCompact":false},{"index":33,"time":"15:24","ratio":0.37817,"inputTokens":48406,"outputTokens":null,"usageSource":"transcript-ratio","credits":4.156,"originalCredits":4.156,"afterCompact":false},{"index":34,"time":"15:24","ratio":0.37915,"inputTokens":48531,"outputTokens":null,"usageSource":"transcript-ratio","credits":3.811,"originalCredits":3.811,"afterCompact":false},{"index":35,"time":"15:25","ratio":0.382895,"inputTokens":49011,"outputTokens":null,"usageSource":"transcript-ratio","credits":4.249,"originalCredits":4.249,"afterCompact":false},{"index":36,"time":"15:25","ratio":0.38383,"inputTokens":49130,"outputTokens":null,"usageSource":"transcript-ratio","credits":4.287,"originalCredits":4.287,"afterCompact":false},{"index":37,"time":"15:25","ratio":0.3858,"inputTokens":49382,"outputTokens":null,"usageSource":"transcript-ratio","credits":4.554,"originalCredits":4.554,"afterCompact":false},{"index":38,"time":"15:26","ratio":0.388675,"inputTokens":49750,"outputTokens":null,"usageSource":"transcript-ratio","credits":4.962,"originalCredits":4.962,"afterCompact":false},{"index":39,"time":"15:26","ratio":0.39143,"inputTokens":50103,"outputTokens":null,"usageSource":"transcript-ratio","credits":4.92,"originalCredits":4.92,"afterCompact":false},{"index":40,"time":"15:27","ratio":0.393765,"inputTokens":50402,"outputTokens":null,"usageSource":"transcript-ratio","credits":4.247,"originalCredits":4.247,"afterCompact":false},{"index":41,"time":"15:27","ratio":0.39459,"inputTokens":50508,"outputTokens":null,"usageSource":"transcript-ratio","credits":4.025,"originalCredits":4.025,"afterCompact":false},{"index":42,"time":"15:27","ratio":0.395235,"inputTokens":50590,"outputTokens":null,"usageSource":"transcript-ratio","credits":3.977,"originalCredits":3.977,"afterCompact":false},{"index":43,"time":"15:28","ratio":0.39588,"inputTokens":50673,"outputTokens":null,"usageSource":"transcript-ratio","credits":4.035,"originalCredits":4.035,"afterCompact":false},{"index":44,"time":"15:28","ratio":0.396515,"inputTokens":50754,"outputTokens":null,"usageSource":"transcript-ratio","credits":4.02,"originalCredits":4.02,"afterCompact":false},{"index":45,"time":"15:29","ratio":0.400915,"inputTokens":51317,"outputTokens":null,"usageSource":"transcript-ratio","credits":7.26,"originalCredits":7.26,"afterCompact":false},{"index":46,"time":"15:29","ratio":0.40906,"inputTokens":52360,"outputTokens":null,"usageSource":"transcript-ratio","credits":4.765,"originalCredits":4.765,"afterCompact":false},{"index":47,"time":"15:29","ratio":0.410055,"inputTokens":52487,"outputTokens":null,"usageSource":"transcript-ratio","credits":4.245,"originalCredits":4.245,"afterCompact":false},{"index":48,"time":"15:30","ratio":0.41084,"inputTokens":52588,"outputTokens":null,"usageSource":"transcript-ratio","credits":4.3,"originalCredits":4.3,"afterCompact":false},{"index":49,"time":"15:30","ratio":0.411975,"inputTokens":52733,"outputTokens":null,"usageSource":"transcript-ratio","credits":4.982,"originalCredits":4.982,"afterCompact":false},{"index":50,"time":"15:31","ratio":0.41551,"inputTokens":53185,"outputTokens":null,"usageSource":"transcript-ratio","credits":6.338,"originalCredits":6.338,"afterCompact":false},{"index":51,"time":"15:31","ratio":0.420335,"inputTokens":53803,"outputTokens":null,"usageSource":"transcript-ratio","credits":4.761,"originalCredits":4.761,"afterCompact":false},{"index":52,"time":"15:32","ratio":0.42133,"inputTokens":53930,"outputTokens":null,"usageSource":"transcript-ratio","credits":5.179,"originalCredits":5.179,"afterCompact":false},{"index":53,"time":"15:32","ratio":0.42414,"inputTokens":54290,"outputTokens":null,"usageSource":"transcript-ratio","credits":4.508,"originalCredits":4.508,"afterCompact":false},{"index":54,"time":"15:32","ratio":0.425495,"inputTokens":54463,"outputTokens":null,"usageSource":"transcript-ratio","credits":5.103,"originalCredits":5.103,"afterCompact":false},{"index":55,"time":"15:33","ratio":0.43392,"inputTokens":55542,"outputTokens":null,"usageSource":"transcript-ratio","credits":5.066,"originalCredits":5.066,"afterCompact":false},{"index":56,"time":"15:33","ratio":0.435095,"inputTokens":55692,"outputTokens":null,"usageSource":"transcript-ratio","credits":4.467,"originalCredits":4.467,"afterCompact":false},{"index":57,"time":"15:34","ratio":0.438115,"inputTokens":56079,"outputTokens":null,"usageSource":"transcript-ratio","credits":5.29,"originalCredits":5.29,"afterCompact":false},{"index":58,"time":"15:34","ratio":0.440095,"inputTokens":56332,"outputTokens":null,"usageSource":"transcript-ratio","credits":4.588,"originalCredits":4.588,"afterCompact":false},{"index":59,"time":"15:36","ratio":0.089415,"inputTokens":11445,"outputTokens":null,"usageSource":"transcript-ratio","credits":6.791,"originalCredits":6.791,"afterCompact":false},{"index":60,"time":"15:36","ratio":0.090563,"inputTokens":11592,"outputTokens":null,"usageSource":"transcript-ratio","credits":5.029,"originalCredits":5.029,"afterCompact":false},{"index":61,"time":"15:37","ratio":0.090734,"inputTokens":11614,"outputTokens":null,"usageSource":"transcript-ratio","credits":4.705,"originalCredits":4.705,"afterCompact":false},{"index":62,"time":"15:44","ratio":0.092135,"inputTokens":11793,"outputTokens":null,"usageSource":"transcript-ratio","credits":36.929,"originalCredits":36.929,"afterCompact":false},{"index":63,"time":"15:44","ratio":0.093216,"inputTokens":11932,"outputTokens":null,"usageSource":"transcript-ratio","credits":5.68,"originalCredits":5.68,"afterCompact":false},{"index":64,"time":"15:44","ratio":0.094448,"inputTokens":12089,"outputTokens":null,"usageSource":"transcript-ratio","credits":6.321,"originalCredits":6.321,"afterCompact":false},{"index":65,"time":"15:45","ratio":0.09519,"inputTokens":12184,"outputTokens":null,"usageSource":"transcript-ratio","credits":5.069,"originalCredits":5.069,"afterCompact":false},{"index":66,"time":"15:45","ratio":0.09542,"inputTokens":12214,"outputTokens":null,"usageSource":"transcript-ratio","credits":5.176,"originalCredits":5.176,"afterCompact":false},{"index":67,"time":"15:53","ratio":0.097114,"inputTokens":12431,"outputTokens":null,"usageSource":"transcript-ratio","credits":39.611,"originalCredits":39.611,"afterCompact":false},{"index":68,"time":"15:53","ratio":0.097603,"inputTokens":12493,"outputTokens":null,"usageSource":"transcript-ratio","credits":5.845,"originalCredits":5.845,"afterCompact":false},{"index":69,"time":"15:54","ratio":0.098107,"inputTokens":12558,"outputTokens":null,"usageSource":"transcript-ratio","credits":5.952,"originalCredits":5.952,"afterCompact":false},{"index":70,"time":"15:54","ratio":0.098764,"inputTokens":12642,"outputTokens":null,"usageSource":"transcript-ratio","credits":5.565,"originalCredits":5.565,"afterCompact":false},{"index":71,"time":"15:55","ratio":0.100313,"inputTokens":12840,"outputTokens":null,"usageSource":"transcript-ratio","credits":6.647,"originalCredits":6.647,"afterCompact":false},{"index":72,"time":"15:55","ratio":0.100903,"inputTokens":12916,"outputTokens":null,"usageSource":"transcript-ratio","credits":5.451,"originalCredits":5.451,"afterCompact":false},{"index":73,"time":"16:09","ratio":0.102516,"inputTokens":13122,"outputTokens":null,"usageSource":"transcript-ratio","credits":41.88,"originalCredits":41.88,"afterCompact":false},{"index":74,"time":"16:09","ratio":0.103046,"inputTokens":13190,"outputTokens":null,"usageSource":"transcript-ratio","credits":5.313,"originalCredits":5.313,"afterCompact":false},{"index":75,"time":"16:10","ratio":0.112286,"inputTokens":14373,"outputTokens":null,"usageSource":"transcript-ratio","credits":13.912,"originalCredits":13.912,"afterCompact":false},{"index":76,"time":"16:10","ratio":0.114359,"inputTokens":14638,"outputTokens":null,"usageSource":"transcript-ratio","credits":6.434,"originalCredits":6.434,"afterCompact":false},{"index":77,"time":"16:14","ratio":0.11446,"inputTokens":14651,"outputTokens":null,"usageSource":"transcript-ratio","credits":23.32,"originalCredits":23.32,"afterCompact":false},{"index":78,"time":"16:14","ratio":0.122158,"inputTokens":15636,"outputTokens":null,"usageSource":"transcript-ratio","credits":9.211,"originalCredits":9.211,"afterCompact":false},{"index":79,"time":"16:14","ratio":0.122394,"inputTokens":15666,"outputTokens":null,"usageSource":"transcript-ratio","credits":6.03,"originalCredits":6.03,"afterCompact":false},{"index":80,"time":"16:15","ratio":0.122519,"inputTokens":15682,"outputTokens":null,"usageSource":"transcript-ratio","credits":6.016,"originalCredits":6.016,"afterCompact":false},{"index":81,"time":"16:15","ratio":0.122948,"inputTokens":15737,"outputTokens":null,"usageSource":"transcript-ratio","credits":6.937,"originalCredits":6.937,"afterCompact":false},{"index":82,"time":"16:16","ratio":0.123486,"inputTokens":15806,"outputTokens":null,"usageSource":"transcript-ratio","credits":7.468,"originalCredits":7.468,"afterCompact":false},{"index":83,"time":"16:16","ratio":0.126546,"inputTokens":16198,"outputTokens":null,"usageSource":"transcript-ratio","credits":8.074,"originalCredits":8.074,"afterCompact":false},{"index":84,"time":"16:17","ratio":0.127204,"inputTokens":16282,"outputTokens":null,"usageSource":"transcript-ratio","credits":7.093,"originalCredits":7.093,"afterCompact":false},{"index":85,"time":"16:27","ratio":0.128838,"inputTokens":16491,"outputTokens":null,"usageSource":"transcript-ratio","credits":55.273,"originalCredits":55.273,"afterCompact":false},{"index":86,"time":"16:27","ratio":0.129704,"inputTokens":16602,"outputTokens":null,"usageSource":"transcript-ratio","credits":6.875,"originalCredits":6.875,"afterCompact":false},{"index":87,"time":"16:27","ratio":0.129942,"inputTokens":16633,"outputTokens":null,"usageSource":"transcript-ratio","credits":7.272,"originalCredits":7.272,"afterCompact":false},{"index":88,"time":"16:28","ratio":0.130546,"inputTokens":16710,"outputTokens":null,"usageSource":"transcript-ratio","credits":6.718,"originalCredits":6.718,"afterCompact":false},{"index":89,"time":"16:32","ratio":0.131958,"inputTokens":16891,"outputTokens":null,"usageSource":"transcript-ratio","credits":18.819,"originalCredits":18.819,"afterCompact":false},{"index":90,"time":"16:32","ratio":0.137203,"inputTokens":17562,"outputTokens":null,"usageSource":"transcript-ratio","credits":8.946,"originalCredits":8.946,"afterCompact":false},{"index":91,"time":"16:32","ratio":0.137581,"inputTokens":17610,"outputTokens":null,"usageSource":"transcript-ratio","credits":7.304,"originalCredits":7.304,"afterCompact":false},{"index":92,"time":"16:33","ratio":0.137991,"inputTokens":17663,"outputTokens":null,"usageSource":"transcript-ratio","credits":7.187,"originalCredits":7.187,"afterCompact":false},{"index":93,"time":"16:33","ratio":0.138319,"inputTokens":17705,"outputTokens":null,"usageSource":"transcript-ratio","credits":8.104,"originalCredits":8.104,"afterCompact":false},{"index":94,"time":"16:34","ratio":0.139059,"inputTokens":17800,"outputTokens":null,"usageSource":"transcript-ratio","credits":8.123,"originalCredits":8.123,"afterCompact":false},{"index":95,"time":"16:34","ratio":0.13976,"inputTokens":17889,"outputTokens":null,"usageSource":"transcript-ratio","credits":7.647,"originalCredits":7.647,"afterCompact":false},{"index":96,"time":"16:35","ratio":0.140203,"inputTokens":17946,"outputTokens":null,"usageSource":"transcript-ratio","credits":8.098,"originalCredits":8.098,"afterCompact":false},{"index":97,"time":"16:35","ratio":0.140832,"inputTokens":18026,"outputTokens":null,"usageSource":"transcript-ratio","credits":7.85,"originalCredits":7.85,"afterCompact":false},{"index":98,"time":"16:36","ratio":0.141306,"inputTokens":18087,"outputTokens":null,"usageSource":"transcript-ratio","credits":7.457,"originalCredits":7.457,"afterCompact":false},{"index":99,"time":"16:36","ratio":0.141643,"inputTokens":18130,"outputTokens":null,"usageSource":"transcript-ratio","credits":7.479,"originalCredits":7.479,"afterCompact":false},{"index":100,"time":"16:47","ratio":0.144517,"inputTokens":18498,"outputTokens":null,"usageSource":"transcript-ratio","credits":65.251,"originalCredits":65.251,"afterCompact":false},{"index":101,"time":"16:47","ratio":0.146549,"inputTokens":18758,"outputTokens":null,"usageSource":"transcript-ratio","credits":8.85,"originalCredits":8.85,"afterCompact":false},{"index":102,"time":"16:48","ratio":0.1472,"inputTokens":18842,"outputTokens":null,"usageSource":"transcript-ratio","credits":7.525,"originalCredits":7.525,"afterCompact":false},{"index":103,"time":"16:48","ratio":0.147399,"inputTokens":18867,"outputTokens":null,"usageSource":"transcript-ratio","credits":7.279,"originalCredits":7.279,"afterCompact":false},{"index":104,"time":"16:48","ratio":0.147574,"inputTokens":18889,"outputTokens":null,"usageSource":"transcript-ratio","credits":7.582,"originalCredits":7.582,"afterCompact":false},{"index":105,"time":"16:49","ratio":0.148124,"inputTokens":18960,"outputTokens":null,"usageSource":"transcript-ratio","credits":7.932,"originalCredits":7.932,"afterCompact":false},{"index":106,"time":"16:53","ratio":0.149715,"inputTokens":19164,"outputTokens":null,"usageSource":"transcript-ratio","credits":9.071,"originalCredits":9.071,"afterCompact":false},{"index":107,"time":"16:53","ratio":0.150438,"inputTokens":19256,"outputTokens":null,"usageSource":"transcript-ratio","credits":7.664,"originalCredits":7.664,"afterCompact":false},{"index":108,"time":"16:54","ratio":0.151814,"inputTokens":19432,"outputTokens":null,"usageSource":"transcript-ratio","credits":8.037,"originalCredits":8.037,"afterCompact":false},{"index":109,"time":"16:54","ratio":0.152196,"inputTokens":19481,"outputTokens":null,"usageSource":"transcript-ratio","credits":7.451,"originalCredits":7.451,"afterCompact":false},{"index":110,"time":"16:57","ratio":0.153548,"inputTokens":19654,"outputTokens":null,"usageSource":"transcript-ratio","credits":12.844,"originalCredits":12.844,"afterCompact":false},{"index":111,"time":"16:57","ratio":0.155829,"inputTokens":19946,"outputTokens":null,"usageSource":"transcript-ratio","credits":8.551,"originalCredits":8.551,"afterCompact":false},{"index":112,"time":"16:57","ratio":0.156202,"inputTokens":19994,"outputTokens":null,"usageSource":"transcript-ratio","credits":7.806,"originalCredits":7.806,"afterCompact":false},{"index":113,"time":"16:58","ratio":0.156366,"inputTokens":20015,"outputTokens":null,"usageSource":"transcript-ratio","credits":7.91,"originalCredits":7.91,"afterCompact":false},{"index":114,"time":"16:58","ratio":0.156773,"inputTokens":20067,"outputTokens":null,"usageSource":"transcript-ratio","credits":9.771,"originalCredits":9.771,"afterCompact":false},{"index":115,"time":"16:59","ratio":0.158992,"inputTokens":20351,"outputTokens":null,"usageSource":"transcript-ratio","credits":10.183,"originalCredits":10.183,"afterCompact":false},{"index":116,"time":"17:01","ratio":0.159867,"inputTokens":20463,"outputTokens":null,"usageSource":"transcript-ratio","credits":16.415,"originalCredits":16.415,"afterCompact":false},{"index":117,"time":"17:02","ratio":0.163642,"inputTokens":20946,"outputTokens":null,"usageSource":"transcript-ratio","credits":9.585,"originalCredits":9.585,"afterCompact":false},{"index":118,"time":"17:02","ratio":0.164053,"inputTokens":20999,"outputTokens":null,"usageSource":"transcript-ratio","credits":8.06,"originalCredits":8.06,"afterCompact":false},{"index":119,"time":"17:02","ratio":0.164184,"inputTokens":21016,"outputTokens":null,"usageSource":"transcript-ratio","credits":8.363,"originalCredits":8.363,"afterCompact":false},{"index":120,"time":"17:03","ratio":0.164493,"inputTokens":21055,"outputTokens":null,"usageSource":"transcript-ratio","credits":8.44,"originalCredits":8.44,"afterCompact":false},{"index":121,"time":"17:04","ratio":0.164856,"inputTokens":21102,"outputTokens":null,"usageSource":"transcript-ratio","credits":8.259,"originalCredits":8.259,"afterCompact":false},{"index":122,"time":"17:04","ratio":0.165066,"inputTokens":21128,"outputTokens":null,"usageSource":"transcript-ratio","credits":8.336,"originalCredits":8.336,"afterCompact":false},{"index":123,"time":"17:08","ratio":0.166522,"inputTokens":21315,"outputTokens":null,"usageSource":"transcript-ratio","credits":9.514,"originalCredits":9.514,"afterCompact":false},{"index":124,"time":"17:09","ratio":0.167624,"inputTokens":21456,"outputTokens":null,"usageSource":"transcript-ratio","credits":12.953,"originalCredits":12.953,"afterCompact":false},{"index":125,"time":"17:10","ratio":0.16965,"inputTokens":21715,"outputTokens":null,"usageSource":"transcript-ratio","credits":9.362,"originalCredits":9.362,"afterCompact":false},{"index":126,"time":"17:10","ratio":0.170243,"inputTokens":21791,"outputTokens":null,"usageSource":"transcript-ratio","credits":8.583,"originalCredits":8.583,"afterCompact":false},{"index":127,"time":"17:10","ratio":0.17042,"inputTokens":21814,"outputTokens":null,"usageSource":"transcript-ratio","credits":8.485,"originalCredits":8.485,"afterCompact":false},{"index":128,"time":"17:11","ratio":0.170817,"inputTokens":21865,"outputTokens":null,"usageSource":"transcript-ratio","credits":9.023,"originalCredits":9.023,"afterCompact":false},{"index":129,"time":"17:12","ratio":0.172431,"inputTokens":22071,"outputTokens":null,"usageSource":"transcript-ratio","credits":10.3,"originalCredits":10.3,"afterCompact":false},{"index":130,"time":"17:12","ratio":0.173142,"inputTokens":22162,"outputTokens":null,"usageSource":"transcript-ratio","credits":8.673,"originalCredits":8.673,"afterCompact":false},{"index":131,"time":"17:12","ratio":0.173301,"inputTokens":22183,"outputTokens":null,"usageSource":"transcript-ratio","credits":8.565,"originalCredits":8.565,"afterCompact":false},{"index":132,"time":"17:15","ratio":0.174865,"inputTokens":22383,"outputTokens":null,"usageSource":"transcript-ratio","credits":15.872,"originalCredits":15.872,"afterCompact":false},{"index":133,"time":"17:16","ratio":0.178353,"inputTokens":22829,"outputTokens":null,"usageSource":"transcript-ratio","credits":12.512,"originalCredits":12.512,"afterCompact":false},{"index":134,"time":"17:16","ratio":0.179637,"inputTokens":22994,"outputTokens":null,"usageSource":"transcript-ratio","credits":9.236,"originalCredits":9.236,"afterCompact":false},{"index":135,"time":"17:16","ratio":0.179796,"inputTokens":23014,"outputTokens":null,"usageSource":"transcript-ratio","credits":8.875,"originalCredits":8.875,"afterCompact":false},{"index":136,"time":"17:17","ratio":0.179985,"inputTokens":23038,"outputTokens":null,"usageSource":"transcript-ratio","credits":9.197,"originalCredits":9.197,"afterCompact":false},{"index":137,"time":"17:17","ratio":0.180383,"inputTokens":23089,"outputTokens":null,"usageSource":"transcript-ratio","credits":9.632,"originalCredits":9.632,"afterCompact":false},{"index":138,"time":"17:18","ratio":0.180886,"inputTokens":23153,"outputTokens":null,"usageSource":"transcript-ratio","credits":9.822,"originalCredits":9.822,"afterCompact":false},{"index":139,"time":"17:18","ratio":0.181424,"inputTokens":23222,"outputTokens":null,"usageSource":"transcript-ratio","credits":8.962,"originalCredits":8.962,"afterCompact":false},{"index":140,"time":"17:18","ratio":0.181555,"inputTokens":23239,"outputTokens":null,"usageSource":"transcript-ratio","credits":9.21,"originalCredits":9.21,"afterCompact":false},{"index":141,"time":"17:19","ratio":0.181878,"inputTokens":23280,"outputTokens":null,"usageSource":"transcript-ratio","credits":9.12,"originalCredits":9.12,"afterCompact":false},{"index":142,"time":"17:19","ratio":0.182352,"inputTokens":23341,"outputTokens":null,"usageSource":"transcript-ratio","credits":9.303,"originalCredits":9.303,"afterCompact":false},{"index":143,"time":"17:20","ratio":0.183856,"inputTokens":23534,"outputTokens":null,"usageSource":"transcript-ratio","credits":11.153,"originalCredits":11.153,"afterCompact":false},{"index":144,"time":"17:21","ratio":0.184733,"inputTokens":23646,"outputTokens":null,"usageSource":"transcript-ratio","credits":10.492,"originalCredits":10.492,"afterCompact":false},{"index":145,"time":"17:21","ratio":0.187722,"inputTokens":24028,"outputTokens":null,"usageSource":"transcript-ratio","credits":10.41,"originalCredits":10.41,"afterCompact":false},{"index":146,"time":"17:21","ratio":0.187921,"inputTokens":24054,"outputTokens":null,"usageSource":"transcript-ratio","credits":9.173,"originalCredits":9.173,"afterCompact":false},{"index":147,"time":"17:23","ratio":0.189327,"inputTokens":24234,"outputTokens":null,"usageSource":"transcript-ratio","credits":11.17,"originalCredits":11.17,"afterCompact":false},{"index":148,"time":"17:23","ratio":0.190112,"inputTokens":24334,"outputTokens":null,"usageSource":"transcript-ratio","credits":9.839,"originalCredits":9.839,"afterCompact":false},{"index":149,"time":"17:25","ratio":0.190662,"inputTokens":24405,"outputTokens":null,"usageSource":"transcript-ratio","credits":14.127,"originalCredits":14.127,"afterCompact":false},{"index":150,"time":"17:25","ratio":0.192837,"inputTokens":24683,"outputTokens":null,"usageSource":"transcript-ratio","credits":10.198,"originalCredits":10.198,"afterCompact":false},{"index":151,"time":"17:25","ratio":0.192964,"inputTokens":24699,"outputTokens":null,"usageSource":"transcript-ratio","credits":9.579,"originalCredits":9.579,"afterCompact":false},{"index":152,"time":"17:26","ratio":0.193245,"inputTokens":24735,"outputTokens":null,"usageSource":"transcript-ratio","credits":9.5,"originalCredits":9.5,"afterCompact":false},{"index":153,"time":"17:26","ratio":0.193424,"inputTokens":24758,"outputTokens":null,"usageSource":"transcript-ratio","credits":9.667,"originalCredits":9.667,"afterCompact":false},{"index":154,"time":"17:28","ratio":0.194892,"inputTokens":24946,"outputTokens":null,"usageSource":"transcript-ratio","credits":10.231,"originalCredits":10.231,"afterCompact":false},{"index":155,"time":"17:28","ratio":0.19551,"inputTokens":25025,"outputTokens":null,"usageSource":"transcript-ratio","credits":10.572,"originalCredits":10.572,"afterCompact":false},{"index":156,"time":"17:29","ratio":0.196196,"inputTokens":25113,"outputTokens":null,"usageSource":"transcript-ratio","credits":9.82,"originalCredits":9.82,"afterCompact":false},{"index":157,"time":"17:33","ratio":0.299148,"inputTokens":38291,"outputTokens":null,"usageSource":"transcript-ratio","credits":1.11,"originalCredits":1.11,"afterCompact":true},{"index":158,"time":"17:33","ratio":0.37425,"inputTokens":47904,"outputTokens":null,"usageSource":"transcript-ratio","credits":0.722,"originalCredits":0.722,"afterCompact":false},{"index":159,"time":"17:33","ratio":0.375258,"inputTokens":48033,"outputTokens":null,"usageSource":"transcript-ratio","credits":0.236,"originalCredits":0.236,"afterCompact":false},{"index":160,"time":"17:33","ratio":0.385031,"inputTokens":49284,"outputTokens":null,"usageSource":"transcript-ratio","credits":1.733,"originalCredits":1.733,"afterCompact":false},{"index":161,"time":"17:33","ratio":0.386844,"inputTokens":49516,"outputTokens":null,"usageSource":"transcript-ratio","credits":0.251,"originalCredits":0.251,"afterCompact":false},{"index":162,"time":"17:34","ratio":0.387836,"inputTokens":49643,"outputTokens":null,"usageSource":"transcript-ratio","credits":0.248,"originalCredits":0.248,"afterCompact":false},{"index":163,"time":"17:34","ratio":0.388906,"inputTokens":49780,"outputTokens":null,"usageSource":"transcript-ratio","credits":0.249,"originalCredits":0.249,"afterCompact":false},{"index":164,"time":"17:34","ratio":0.391703,"inputTokens":50138,"outputTokens":null,"usageSource":"transcript-ratio","credits":0.261,"originalCredits":0.261,"afterCompact":false},{"index":165,"time":"17:34","ratio":0.393094,"inputTokens":50316,"outputTokens":null,"usageSource":"transcript-ratio","credits":0.25,"originalCredits":0.25,"afterCompact":false},{"index":166,"time":"17:34","ratio":0.404594,"inputTokens":51788,"outputTokens":null,"usageSource":"transcript-ratio","credits":2.003,"originalCredits":2.003,"afterCompact":false},{"index":167,"time":"17:35","ratio":0.411938,"inputTokens":52728,"outputTokens":null,"usageSource":"transcript-ratio","credits":0.535,"originalCredits":0.535,"afterCompact":false},{"index":168,"time":"17:35","ratio":0.42332,"inputTokens":54185,"outputTokens":null,"usageSource":"transcript-ratio","credits":0.348,"originalCredits":0.348,"afterCompact":false},{"index":169,"time":"17:35","ratio":0.425133,"inputTokens":54417,"outputTokens":null,"usageSource":"transcript-ratio","credits":0.267,"originalCredits":0.267,"afterCompact":false},{"index":170,"time":"17:35","ratio":0.428602,"inputTokens":54861,"outputTokens":null,"usageSource":"transcript-ratio","credits":0.307,"originalCredits":0.307,"afterCompact":false},{"index":171,"time":"17:36","ratio":0.441328,"inputTokens":56490,"outputTokens":null,"usageSource":"transcript-ratio","credits":0.35,"originalCredits":0.35,"afterCompact":false},{"index":172,"time":"17:36","ratio":0.45343,"inputTokens":58039,"outputTokens":null,"usageSource":"transcript-ratio","credits":0.355,"originalCredits":0.355,"afterCompact":false},{"index":173,"time":"17:36","ratio":0.454695,"inputTokens":58201,"outputTokens":null,"usageSource":"transcript-ratio","credits":0.276,"originalCredits":0.276,"afterCompact":false},{"index":174,"time":"17:36","ratio":0.455477,"inputTokens":58301,"outputTokens":null,"usageSource":"transcript-ratio","credits":0.279,"originalCredits":0.279,"afterCompact":false},{"index":175,"time":"17:40","ratio":0.483477,"inputTokens":61885,"outputTokens":null,"usageSource":"transcript-ratio","credits":0.493,"originalCredits":0.493,"afterCompact":false},{"index":176,"time":"17:40","ratio":0.48557,"inputTokens":62153,"outputTokens":null,"usageSource":"transcript-ratio","credits":0.306,"originalCredits":0.306,"afterCompact":false},{"index":177,"time":"17:40","ratio":0.486516,"inputTokens":62274,"outputTokens":null,"usageSource":"transcript-ratio","credits":0.301,"originalCredits":0.301,"afterCompact":false},{"index":178,"time":"17:40","ratio":0.48918,"inputTokens":62615,"outputTokens":null,"usageSource":"transcript-ratio","credits":0.311,"originalCredits":0.311,"afterCompact":false},{"index":179,"time":"17:40","ratio":0.490758,"inputTokens":62817,"outputTokens":null,"usageSource":"transcript-ratio","credits":0.303,"originalCredits":0.303,"afterCompact":false},{"index":180,"time":"17:40","ratio":0.491555,"inputTokens":62919,"outputTokens":null,"usageSource":"transcript-ratio","credits":0.302,"originalCredits":0.302,"afterCompact":false},{"index":181,"time":"17:40","ratio":0.492437,"inputTokens":63032,"outputTokens":null,"usageSource":"transcript-ratio","credits":0.31,"originalCredits":0.31,"afterCompact":false},{"index":182,"time":"17:40","ratio":0.49507,"inputTokens":63369,"outputTokens":null,"usageSource":"transcript-ratio","credits":0.316,"originalCredits":0.316,"afterCompact":false},{"index":183,"time":"17:41","ratio":0.495937,"inputTokens":63480,"outputTokens":null,"usageSource":"transcript-ratio","credits":0.321,"originalCredits":0.321,"afterCompact":false},{"index":184,"time":"17:41","ratio":0.50182,"inputTokens":64233,"outputTokens":null,"usageSource":"transcript-ratio","credits":0.371,"originalCredits":0.371,"afterCompact":false},{"index":185,"time":"17:41","ratio":0.504203,"inputTokens":64538,"outputTokens":null,"usageSource":"transcript-ratio","credits":0.326,"originalCredits":0.326,"afterCompact":false},{"index":186,"time":"17:41","ratio":0.507227,"inputTokens":64925,"outputTokens":null,"usageSource":"transcript-ratio","credits":0.445,"originalCredits":0.445,"afterCompact":false},{"index":187,"time":"17:41","ratio":0.516148,"inputTokens":66067,"outputTokens":null,"usageSource":"transcript-ratio","credits":0.408,"originalCredits":0.408,"afterCompact":false},{"index":188,"time":"17:41","ratio":0.518992,"inputTokens":66431,"outputTokens":null,"usageSource":"transcript-ratio","credits":0.329,"originalCredits":0.329,"afterCompact":false},{"index":189,"time":"17:41","ratio":0.520422,"inputTokens":66614,"outputTokens":null,"usageSource":"transcript-ratio","credits":0.319,"originalCredits":0.319,"afterCompact":false},{"index":190,"time":"17:42","ratio":0.521242,"inputTokens":66719,"outputTokens":null,"usageSource":"transcript-ratio","credits":0.318,"originalCredits":0.318,"afterCompact":false},{"index":191,"time":"17:42","ratio":0.522656,"inputTokens":66900,"outputTokens":null,"usageSource":"transcript-ratio","credits":0.348,"originalCredits":0.348,"afterCompact":false},{"index":192,"time":"17:42","ratio":0.527516,"inputTokens":67522,"outputTokens":null,"usageSource":"transcript-ratio","credits":0.397,"originalCredits":0.397,"afterCompact":false},{"index":193,"time":"17:42","ratio":0.530961,"inputTokens":67963,"outputTokens":null,"usageSource":"transcript-ratio","credits":0.422,"originalCredits":0.422,"afterCompact":false},{"index":194,"time":"17:42","ratio":0.536758,"inputTokens":68705,"outputTokens":null,"usageSource":"transcript-ratio","credits":0.37,"originalCredits":0.37,"afterCompact":false},{"index":195,"time":"17:42","ratio":0.538641,"inputTokens":68946,"outputTokens":null,"usageSource":"transcript-ratio","credits":0.339,"originalCredits":0.339,"afterCompact":false},{"index":196,"time":"17:42","ratio":0.539625,"inputTokens":69072,"outputTokens":null,"usageSource":"transcript-ratio","credits":0.38,"originalCredits":0.38,"afterCompact":false},{"index":197,"time":"17:42","ratio":0.5445,"inputTokens":69696,"outputTokens":null,"usageSource":"transcript-ratio","credits":0.415,"originalCredits":0.415,"afterCompact":false},{"index":198,"time":"17:43","ratio":0.548109,"inputTokens":70158,"outputTokens":null,"usageSource":"transcript-ratio","credits":0.435,"originalCredits":0.435,"afterCompact":false},{"index":199,"time":"17:43","ratio":0.558984,"inputTokens":71550,"outputTokens":null,"usageSource":"transcript-ratio","credits":0.635,"originalCredits":0.635,"afterCompact":false},{"index":200,"time":"17:43","ratio":0.570031,"inputTokens":72964,"outputTokens":null,"usageSource":"transcript-ratio","credits":0.426,"originalCredits":0.426,"afterCompact":false},{"index":201,"time":"17:43","ratio":0.572109,"inputTokens":73230,"outputTokens":null,"usageSource":"transcript-ratio","credits":0.351,"originalCredits":0.351,"afterCompact":false},{"index":202,"time":"17:43","ratio":0.572828,"inputTokens":73322,"outputTokens":null,"usageSource":"transcript-ratio","credits":0.352,"originalCredits":0.352,"afterCompact":false},{"index":203,"time":"17:44","ratio":0.574359,"inputTokens":73518,"outputTokens":null,"usageSource":"transcript-ratio","credits":0.391,"originalCredits":0.391,"afterCompact":false},{"index":204,"time":"17:44","ratio":0.57725,"inputTokens":73888,"outputTokens":null,"usageSource":"transcript-ratio","credits":0.422,"originalCredits":0.422,"afterCompact":false},{"index":205,"time":"17:44","ratio":0.582742,"inputTokens":74591,"outputTokens":null,"usageSource":"transcript-ratio","credits":0.377,"originalCredits":0.377,"afterCompact":false},{"index":206,"time":"17:44","ratio":0.583516,"inputTokens":74690,"outputTokens":null,"usageSource":"transcript-ratio","credits":0.374,"originalCredits":0.374,"afterCompact":false},{"index":207,"time":"17:46","ratio":0.606961,"inputTokens":77691,"outputTokens":null,"usageSource":"transcript-ratio","credits":4.352,"originalCredits":4.352,"afterCompact":false},{"index":208,"time":"17:48","ratio":0.617805,"inputTokens":79079,"outputTokens":null,"usageSource":"transcript-ratio","credits":0.439,"originalCredits":0.439,"afterCompact":false},{"index":209,"time":"17:48","ratio":0.619445,"inputTokens":79289,"outputTokens":null,"usageSource":"transcript-ratio","credits":0.367,"originalCredits":0.367,"afterCompact":false},{"index":210,"time":"17:49","ratio":0.628828,"inputTokens":80490,"outputTokens":null,"usageSource":"transcript-ratio","credits":0.439,"originalCredits":0.439,"afterCompact":false},{"index":211,"time":"17:49","ratio":0.631406,"inputTokens":80820,"outputTokens":null,"usageSource":"transcript-ratio","credits":0.396,"originalCredits":0.396,"afterCompact":false},{"index":212,"time":"17:49","ratio":0.632414,"inputTokens":80949,"outputTokens":null,"usageSource":"transcript-ratio","credits":0.384,"originalCredits":0.384,"afterCompact":false}],"identity":{"sumAttributed":7963862,"billedInputTokens":7963862,"absDiff":0,"ok":true},"pluginVersion":"2.7.4","selfCmd":"\"C:\\Users\\Charien\\.qoder-cn\\plugins\\cache\\qoder-marketplace\\qoder-credits-inspector\\2.7.4\\bin\\credits-inspector.cmd\" cli","linkHealth":{"matched":0,"requests":212,"coverage":0,"usageSource":"transcript-ratio","breakdown":{"proxy":0,"transcriptTokens":0,"transcriptRatio":212},"logRecords":0,"lastRecordAt":null,"recentRequests":0,"proxyErrors":null,"clientAbort":null,"clientAbortMaxMs":null,"upstreamRejected":null,"aborted":null,"truncated":null,"noUsage":null,"slowestMs":null,"supersededFailure":null},"subagents":{"scanned":false,"dir":null,"probedPaths":["C:\\Users\\Charien\\.qoder-cn\\projects\\F--myhomepage\\539a8c3a-c70a-406b-adfe-50c1b6449066\\subagents","C:\\Users\\Charien\\.qoder-cn\\projects\\539a8c3a-c70a-406b-adfe-50c1b6449066\\subagents"],"reason":"no-dir","count":0,"items":[],"totals":{"roundTrips":0,"billedInputTokens":0,"credits":0,"originalCredits":0},"combined":{"roundTrips":212,"billedInputTokens":7963862,"credits":1378.764,"originalCredits":1378.764}},"manual":null,"artifacts":{"report":"report.json","canvas":"当前工作区是我的个人主页，但是现在的设计和交互逻__539a8c3a.canvas.tsx"}} as unknown as Report;

function human(n: number): string {
  if (!isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (abs >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (abs >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(Math.round(n));
}

function pct(x: number): string {
  return (x * 100).toFixed(1) + "%";
}

// —— 可用性口径：把 report.availability 翻成人话，并决定某个数字该显示值、「≈」还是「—」——
const AVAIL_LABEL: Record<string, string> = {
  measured: "实测",
  derived: "推导",
  fallback: "回退",
  manual: "手工",
  unavailable: "不可用",
};

const SOURCE_LABEL: Record<string, string> = {
  "desktop-rich": "桌面端富转录",
  "ide-lite": "IDE 端精简转录",
  unknown: "来源未知",
};

function availOf(av: Availability | undefined, key: keyof Availability, dflt: Avail = "measured"): Avail {
  return (av?.[key] as Avail | undefined) ?? dflt;
}

/** 段标题旁的性质标注：实测不标（默认就是实测），其余标出来。 */
function availTag(av: Availability | undefined, key: keyof Availability, dflt: Avail = "measured"): string {
  const v = availOf(av, key, dflt);
  return v === "measured" ? "" : `（${AVAIL_LABEL[v]}）`;
}

/** 不可用的量显示「—」而不是 0：IDE 端的 0 是「读不到」，不是「没发生」。 */
function orDash(
  v: number,
  av: Availability | undefined,
  key: keyof Availability,
  fmt: (n: number) => string = String
): string {
  return availOf(av, key) === "unavailable" ? "—" : fmt(v);
}

function kindLabel(kind: string): string {
  switch (kind) {
    case "read":
      return "读取";
    case "write":
      return "写入";
    case "search":
      return "搜索";
    case "shell":
      return "命令";
    default:
      return "其他";
  }
}

function shortTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  const p = (v: number) => String(v).padStart(2, "0");
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function SessionTokensReport() {
  if (!REPORT) {
    return (
      <ReportShell width="wide" ariaLabel="会话 token 消耗截析">
        <Stack gap="component">
          <H1>会话 token 消耗截析</H1>
          <Text tone="secondary">报告数据尚未注入。请在会话中触发一次 Stop 钩子，或运行 CLI 生成 report.json。</Text>
        </Stack>
      </ReportShell>
    );
  }

  const r = REPORT;
  const s = r.session;
  const c = r.context;
  const t = r.totals;
  const av = r.availability;
  const manual = r.manual ?? null;
  const sourceLabel = SOURCE_LABEL[r.source ?? "unknown"] ?? "来源未知";
  // 有没有 usage 决定整份报告是「真值/推导」还是「一律 —」。手工回填的 credits 不算有 usage，
  // 否则下面按 ratio 推导的图表会照画一堆 0。
  const hasUsage = availOf(av, "roundTrips") === "measured";
  const manualCredits = manual?.credits ?? null;

  // 报告里出现的命令一律用数据层注入的插件入口（Windows 上是自带启动器的绝对路径，免装 Node）。
  // 旧报告没有这个字段时回退原写法，不比改动前更差。
  const CLI = r.selfCmd || "node scripts/cli.mjs";

  // credits 覆盖范围：credits 与「计费输入总量」并排放在头部，读者一除就得到单价。
  // 混合会话里 credits 只来自转录路径的那几笔（实测某会话 413 笔里只有 1 笔带 credits），
  // 部分覆盖不说出来 = 把局部真值当全量展示。
  const cov = r.creditsCoverage ?? null;
  const covPartial = !!(cov && !cov.full && cov.roundTrips > 0);
  const covNote = covPartial ? ` · 仅覆盖 ${cov!.trips}/${cov!.roundTrips} 笔往返（占计费输入 ${pct(cov!.tokenShare)}）` : "";

  // 缓存命中：代理记录里一直带着 cachedTokens，此前采集了却从不呈现。
  const cachedMeasured = availOf(av, "cachedTokens") === "measured";
  const cachedText = cachedMeasured
    ? `输入 ${human(t.billedInputTokens)}，其中缓存命中 ${human(t.cachedTokens ?? 0)}（${pct(t.cachedShare ?? 0)}，${t.cachedTrips ?? 0} 笔往返带缓存）——供应商对重复叠加的前缀打折，故按 token 数的节省大于按计费的节省。`
    : "";

  // 代理告警只在「失败记录仍然成立」时才报：status.json 只写不清，陈旧失败会把用户推去改
  // 本来正确的 Base URL，越修越坏；而同一份报告里的 lastRecordAt / matched 是它在跑的硬证据。
  const proxyAlarm = r.proxy?.status && !r.proxy.statusSuperseded ? r.proxy.status : null;
  const proxyAlive = !proxyAlarm && (r.proxy?.logRecords ?? 0) > 0;

  // 官方 UI 一场会话扣费 = 主链 + 子代理，故有子代理时 headline 必须给 combined，否则比 UI 少一截
  const creditScope =
    r.subagents && r.subagents.count > 0
      ? {
          credits: r.subagents.combined.credits,
          note: `主链 ${t.credits} + 子代理 ${r.subagents.totals.credits} · 原始 ${r.subagents.combined.originalCredits}`,
        }
      : { credits: t.credits, note: `原始 ${t.originalCredits}（实测）` };

  const headline: MetricItem[] = [
    {
      label: "计费输入总量",
      value: hasUsage ? human(t.billedInputTokens) : "—",
      description: hasUsage
        ? availOf(av, "tokens") === "measured"
          ? `Σ prompt_tokens（实测真值）${covPartial ? ` · 覆盖全部 ${cov!.roundTrips} 笔往返` : ""}`
          : `Σ 上下文 × 往返${availTag(av, "tokens", "derived")}${covPartial ? ` · 覆盖全部 ${cov!.roundTrips} 笔往返` : ""}`
        : "转录无 usage",
    },
    {
      label: "当前上下文",
      value: hasUsage ? human(t.netContextTokens) : "—",
      description: hasUsage
        ? `峰值 ${pct(c.peakContextRatio)}${s.compactions ? "（压缩后起算）" : ""}`
        : "转录无 usage",
    },
    {
      label: "重发放大",
      value: hasUsage ? `${t.amplification}×` : "—",
      description: `往返 ${hasUsage ? `${s.roundTrips} 次` : "—"}`,
    },
    {
      label: "Credits",
      // 代理路径（自定义模型）token 是实测真值但 credits 无来源：hasUsage 为真也要显示「—」，
      // 否则 t.credits=0 会被读成「这次没花钱」。
      value:
        manualCredits != null
          ? `${manualCredits}`
          : hasUsage && availOf(av, "credits") !== "unavailable"
            ? `${creditScope.credits}`
            : "—",
      description:
        manualCredits != null
          ? `官方 UI 手工录入 · 本地 ${creditScope.credits}`
          : hasUsage && availOf(av, "credits") !== "unavailable"
            ? `${creditScope.note}${covNote}`
            : r.usageSource === "proxy" || r.usageSource === "transcript-tokens" || r.usageSource === "mixed"
              ? "自定义模型（BYOK）不经 Qoder 计费网关，无 credits 真值"
              : hasUsage
                ? "转录带 usage 但没有 credits 字段，本地无计费真值"
                : "本地不可用，见下方告警",
    },
  ];

  const pieData = r.byCategory.map((x) => ({ label: x.label, value: x.tokens }));

  // 系统提示词是报告里少数「用户能直接动」的一项：它每轮被完整重发，总量 = 每请求规模 × 往返数，
  // 而它的大小由装了多少插件与技能决定。占比小时不必啰嗦。
  const sysCat = r.byCategory.find((x) => x.key === "system");
  const sysNote =
    hasUsage && sysCat && sysCat.share >= 0.1
      ? ` 系统提示词占 ${pct(sysCat.share)}（${human(c.systemPromptTokens)}/请求 × ${s.roundTrips} 次往返 = ${human(sysCat.tokens)}）：它每轮都被完整重发，大小由你装了多少插件与技能决定，精简技能能直接压低这一项——本插件自己的技能描述也常驻在里面（约 170 token）。`
      : "";

  const tools = r.byTool.slice(0, 8);
  const toolCategories = tools.map((x) => x.tool);
  const toolSeries = [{ name: "重发 tokens", data: tools.map((x) => x.tokens) }];
  // 「单次」= 平均每次调用带来的重发 token。总量榜会埋掉次数少但每次极贵的工具：
  // 实测 Read 只 29 次却吃 335 万，单次是 Edit 的 2.6 倍。
  const toolRows = tools.map((x) => [
    x.tool,
    human(x.tokens),
    pct(x.share),
    String(x.calls),
    x.perCall == null ? "—" : human(x.perCall),
  ]);

  const files = r.byFile.slice(0, 20);
  const fileRows = files.map((f) => [
    f.label,
    kindLabel(f.kind),
    human(f.billed),
    pct(f.share),
    f.perRead == null ? "—" : human(f.perRead),
    String(f.trips),
    String(f.reads),
  ]);

  const byReq = r.byRequest ?? [];
  const reqLabels = byReq.map((x, i) => x.time || `#${x.index ?? i + 1}`);
  const reqInputs = byReq.map((x) => x.inputTokens);
  const reqCredits = byReq.map((x) => x.credits);
  // credits 只在覆盖全部往返时才画曲线：部分覆盖（BYOK 混合会话实测 413 笔里 1 笔有 credits）
  // 画出来是一地零，既读不出形状，还会暗示「其余往返没花钱」。
  const showCreditsChart = hasUsage && !covPartial && availOf(av, "credits") !== "unavailable";

  // 按类别下钻：类别小计行（accent/neutral）+ 其工具/文件明细行（default），用 rowTone 分组着色。
  const catDetail = r.byCategoryDetail ?? [];
  const detailRows: string[][] = [];
  const detailTones: ("accent" | "neutral" | "default")[] = [];
  for (const cc of catDetail) {
    const hasKids = cc.children.length > 0;
    detailRows.push([cc.label, "—", hasKids ? "小计" : "（整体，无工具/文件归属）", human(cc.tokens), pct(cc.share), "100%", "—"]);
    detailTones.push(hasKids ? "accent" : "neutral");
    for (const k of cc.children) {
      detailRows.push(["", k.tool || "—", k.label, human(k.tokens), pct(k.share), pct(k.catShare), String(k.trips)]);
      detailTones.push("default");
    }
  }

  // 子代理账：Agent 派发的子代理消耗不在主链里，单独一段呈现（无子代理则整段不渲染）。
  const sub = r.subagents;
  const subItems = sub?.items ?? [];
  const subRows: string[][] = [];
  const subTones: ("accent" | "default")[] = [];
  for (const a of subItems) {
    subRows.push([
      a.description || a.agentId,
      a.agentType || "—",
      String(a.roundTrips),
      human(a.billedInputTokens),
      pct(a.peakContextRatio),
      String(a.credits),
      String(a.originalCredits),
      a.error || "—",
    ]);
    subTones.push("default");
  }
  if (sub && subItems.length > 0) {
    subRows.push([
      "合计（主链 + 子代理）",
      "—",
      String(sub.combined.roundTrips),
      human(sub.combined.billedInputTokens),
      "—",
      String(sub.combined.credits),
      String(sub.combined.originalCredits),
      `主链 ${t.credits} / 子代理 ${sub.totals.credits}`,
    ]);
    subTones.push("accent");
  }

  // 压缩单笔成本：输入/摘要一律取数据层归一后的生效值（有代理实测就是实测，否则是客户端自估），
  // 并用「口径」列把两者分开——混着显示会让自估值被当成实测。
  const ccost = r.compactionCost;
  const ccItems = ccost?.items ?? [];
  const compactRows: string[][] = ccItems.map((e) => [
    `#${e.index}`,
    shortTime(e.at),
    e.trigger || "—",
    e.effectiveInputTokens == null ? "—" : human(e.effectiveInputTokens),
    e.effectiveOutputTokens == null ? "—" : human(e.effectiveOutputTokens),
    e.nextInputTokens == null ? "—" : human(e.nextInputTokens),
    e.savedTokens == null ? "—" : human(e.savedTokens),
    e.proxy && e.proxy.ms != null ? `${Math.round(e.proxy.ms / 1000)}s` : "—",
    e.proxy ? "实测" : "自估",
  ]);

  // IDE 端仅剩的真值：工具调用次数与文件读取次数（不依赖 usage，两种转录都写 tool_use 块）。
  const residueRows: string[][] = [];
  if (!hasUsage) {
    for (const x of r.byTool.filter((v) => v.calls > 0).sort((a, b) => b.calls - a.calls).slice(0, 15)) {
      residueRows.push([x.tool, "工具", String(x.calls), "—", "—"]);
    }
    for (const f of r.byFile.filter((v) => v.reads > 0).sort((a, b) => b.reads - a.reads).slice(0, 15)) {
      residueRows.push([f.label, kindLabel(f.kind), "—", String(f.reads), String(f.trips)]);
    }
  }

  // A1 三值：一次带 usage 的往返都没有时 0 <= max(2,0) 恒成立，会把「没数据」判成「校验通过」，
  // 故 breakdown.mjs 在 reqCount===0 时给 null；这里必须显示「不适用」而不是绿色通过。
  const identityText =
    r.identity.ok == null
      ? "恒等式 A1 不适用（本转录没有一次带 usage 的往返）。"
      : r.identity.ok
        ? `归因覆盖 ${pct(t.coverage)}${availTag(av, "categoryShare", "derived")}，恒等式 A1 通过（|Δ|=${r.identity.absDiff}）。`
        : `归因覆盖 ${pct(t.coverage)}，恒等式 A1 未通过（|Δ|=${r.identity.absDiff}）。`;
  // 窗口读不到时是静默回退的 200000，而所有 token 数字都乘它 —— 必须显式标 ≈ 与来源。
  const cwIsFallback = availOf(av, "contextWindow") === "fallback";
  const cwText = cwIsFallback ? `≈${human(c.contextWindow)}（回退值）` : human(c.contextWindow);
  // 当前占用头条：以最新上下文（currentContextTokens）为准；段内单调递增 ⇒ 旧版峰值与当前恒等，故合并为一条。
  const curCtx = c.currentContextTokens ?? c.peakContextTokens;
  const netAdv = c.netUserAdvice || c.peakUserAdvice || c.peakAdvice || null;
  const limitSrcLabel =
    c.userContextLimitSource === "manual" ? "手工"
    : c.userContextLimitSource === "config" ? "配置"
    : c.userContextLimitSource === "derived" ? "实测反推"
    : "默认";
  // 阈值来源非 manual/config/derived ⇒ 用的是内置兜底 200K，不是用户在 Qoder 设的真值，需显式提示如何改。
  const limitIsDefault = c.userContextLimitSource !== "manual" && c.userContextLimitSource !== "config" && c.userContextLimitSource !== "derived";
  // 上下文对比表：把旧版挤成一段小字的「界面显示 / 自动压缩实况 / 历史高点」拆成可扫读的行，无数据不占位。
  const ctxRows: string[][] = [];
  if (c.userContextLimit != null && Number.isFinite(c.contextWindow)) {
    ctxRows.push(
      c.contextWindow > c.userContextLimit
        ? ["Qoder 界面进度条", pct(c.netWindowRatio ?? c.peakContextRatio), `按模型物理窗口 ${cwText} 算，比你真实占比低约 ${(c.contextWindow / c.userContextLimit).toFixed(1)} 倍——界面显得偏空、有迷惑性，别信它`]
        : ["Qoder 界面进度条", pct(c.netWindowRatio ?? c.peakContextRatio), `按模型窗口 ${cwText} 算，与你实设上限一致，显示无偏差`],
    );
  }
  if (c.observedAutoCompactions != null && c.observedAutoCompactions > 0 && c.observedAutoTriggerTokens != null) {
    ctxRows.push(["自动压缩实况", `自动 ${c.observedAutoCompactions} 次`, `触发点在 ~${human(c.observedAutoTriggerTokens)}（窗口的 ${pct(c.autoTriggerRatio ?? 0)}）`]);
  } else if (s.compactions > 0) {
    ctxRows.push(["压缩实况", `手动 ${s.compactions} 次`, "本场未见自动压缩，均为你手动触发"]);
  }
  if (c.peakSessionNotable) {
    ctxRows.push(["压缩前历史高点", `${pct(c.peakSessionRatio ?? 0)}（${human(c.peakSessionTokens ?? 0)}）`, "本场曾达到的最高占用"]);
  }

  // 链路健康度：把 --request-log 的逐笔归因压成一行结论（明细属于排障，留在 CLI）。
  // 分两档：本会话确实走在代理链路上（proxy/mixed）才印「最近 N 笔」的失败统计与排障命令；
  // token 全来自转录的会话里，那些统计说的是别的会话，印成 warning + 命令是噪音，只留覆盖率与最近记录时间。
  // 纯官方模型用户从没配过代理，整行不渲染。
  const lhRaw = r.linkHealth ?? null;
  const lh = lhRaw && (r.proxy?.configured || lhRaw.matched > 0) ? lhRaw : null;
  const lhOnPath = !!lh && (lh.matched > 0 || lh.usageSource === "proxy" || lh.usageSource === "mixed");
  const lhErrors = lh ? lh.proxyErrors ?? 0 : 0;
  const lhBad = lhOnPath && lhErrors > 0;
  const lhTone: "info" | "warning" = lhBad ? "warning" : "info";
  // 三档拆分一行说清：代理实测 / 转录 input_tokens / 转录 ratio×window 各多少笔。
  // 旧报告（v3）无 breakdown 字段时退回到只报 matched。
  const lhBd = lh?.breakdown ?? null;
  const lhBdText = lhBd
    ? `拆分：代理 ${lhBd.proxy} 笔 · 转录 input_tokens ${lhBd.transcriptTokens} 笔 · 转录 ratio×窗口 ${lhBd.transcriptRatio} 笔`
    : "";
  const lhSrcNote = !lh
    ? ""
    : lh.usageSource === "proxy"
      ? "：全部为供应商实测"
      : lh.usageSource === "transcript-tokens"
        ? "：本会话 token 全来自转录 input_tokens（BYOK，代理未在链路上）"
        : lh.usageSource === "transcript-ratio"
          ? "：本会话 token 由 ratio×窗口推导（官方模型）"
          : lh.usageSource === "mixed"
            ? "：多源混合，以下拆分列为准"
            : lh.usageSource === "transcript"
              ? "：本会话 token 全部来自转录，代理不在链路上"
              : "";
  const lhText = !lh
    ? ""
    : [
        lh.requests > 0
          ? `代理覆盖 ${lh.matched}/${lh.requests} 笔往返（${pct(lh.coverage)}）${lhSrcNote}`
          : "本会话没有带 usage 的往返，代理无从覆盖",
        lhBdText,
        lh.lastRecordAt ? `代理最近记录 ${shortTime(lh.lastRecordAt)}` : proxyAlive ? "代理有记录但无时间戳" : "代理从未记到流量",
        lhOnPath && lh.recentRequests
          ? `最近 ${lh.recentRequests} 笔：代理失败 ${lh.proxyErrors} · 上游报错 ${lh.upstreamRejected} · 客户端提前断开 ${lh.aborted} · 成功但无 usage ${lh.noUsage}${
              lh.slowestMs != null ? ` · 最慢 ${Math.round(lh.slowestMs / 1000)}s` : ""
            }`
          : lhOnPath
            ? "请求诊断日志为空（运行中的代理是旧版，或还没记到）"
            : "",
        lhBad ? `有「代理失败」= 请求没出得去或代理自己抛了，跑 ${CLI} --request-log 看归因` : "",
        !lhOnPath && lhErrors > 0 ? `代理另有 ${lhErrors} 笔失败，属于走代理的那些会话` : "",
        lh.supersededFailure
          ? `${shortTime(lh.supersededFailure.at ?? null)} 那条「拉起失败（${lh.supersededFailure.error}）」已被之后的流量推翻，无需处理`
          : "",
      ]
        .filter(Boolean)
        .join("。") + "。";

  return (
    <ReportShell width="wide" ariaLabel="会话 token 消耗截析">
      <Stack gap="sectionCompact">
        <header>
          <Stack gap="component">
            <H1>会话 token 消耗截析</H1>
            <Text tone="secondary">
              {s.model || "未知模型"}
              {s.modelSource === "manual" ? "（手工录入）" : ""} · {sourceLabel} · 会话{" "}
              {String(s.id || "").slice(0, 8)}
              {s.title ? `「${s.title}」` : ""} · {shortTime(s.startedAt)} →{" "}
              {shortTime(s.endedAt)} · 压缩{" "}
              {availOf(av, "compactions") === "unavailable" ? "—" : `${s.compactions} 次`}
              {r.usageSource ? ` · usage 来源 ${
                r.usageSource === "proxy"
                  ? "代理实测"
                  : r.usageSource === "transcript-tokens"
                    ? "转录 input_tokens"
                    : r.usageSource === "transcript-ratio"
                      ? "转录 ratio×窗口"
                      : r.usageSource === "mixed"
                        ? "多源混合"
                        : "转录"
              }` : ""}
              {r.pluginVersion ? ` · v${r.pluginVersion}` : ""} · schema v{r.schemaVersion}
            </Text>
            <MetricsGrid variant="header" columns={4} items={headline} />
          </Stack>
        </header>

        {!hasUsage && r.source === "desktop-rich" && (
          <Callout tone="danger" title="本报告数值不可用：自定义模型（BYOK）不经 Qoder 计费网关">
            转录是桌面端富布局，但 assistant entry 里没有 message.usage——自定义模型（如千问
            tokenplan）的响应不经 Qoder 计费网关，credits / context_usage_ratio 无来源，提供商返回的
            usage 客户端也不落盘（已实测扫过 ~/.qoder-cn、~/.qoder、~/.qoder-cli 与 %APPDATA%\QoderCN）。
            本地补救（改一个配置文件即可，免装 Node、之后全自动）：编辑 {"`~/.qoder-credits-proxy/config.json`"}，
            把 {"`upstream`"} 填成你的供应商根地址（= Base URL 去掉结尾 /v1），再把自定义模型 Base URL 的 host:port
            换成 {`127.0.0.1:${r.proxy?.port ?? 49787}`}（路径保留），新开一个会话即自动拉起代理、按 message.id
            精确 join 出实测 token（credits 仍无真值）。装了 Node 也可用 {"`--setup-proxy`"} / {"`--check-proxy`"} 一步到位。
            手工回填通道同样可用：
            {"`.qoder-credits/overrides/<sessionId>.json`"}。
          </Callout>
        )}

        {!hasUsage && r.source !== "desktop-rich" && (
          <Callout tone="danger" title="本报告数值不可用：转录不含 message.usage">
            这是 {sourceLabel}（IDE 端客户端）。它的转录只写 session_meta / user / assistant / progress 四种 entry，
            message.usage 整个字段不存在，也不落到本地任何其它文件（已实测扫过 ~/.qoder-cn、~/.qoder、
            ~/.qoder-cli 与 %APPDATA%\QoderCN）。因此 Credits、token 与各类占比一律显示「—」而不是 0 ——
            0 会被误读成「这次没花钱」。真值只有官方 UI 有：把它填进{" "}
            {"`.qoder-credits/overrides/<sessionId>.json`"} 后重跑，上方会出现「官方 UI 真值」一段并与本地并列对账。
          </Callout>
        )}

        {manual && (
          <Callout tone="success" title="官方 UI 真值（手工录入，未覆盖任何本地数字）">
            Credits {manual.credits ?? "—"} · 原价 {manual.originalCredits ?? "—"}
            {manual.model ? ` · 模型 ${manual.model}` : ""}
            {manual.durationMin != null ? ` · 时长 ${manual.durationMin} min` : ""}
            {manual.startedAt ? ` · ${shortTime(manual.startedAt)}` : ""}
            {manual.localCoverage != null
              ? ` · 本地${manual.localScope === "combined" ? "合计（主链+子代理）" : "主链"} ${manual.localCredits ?? t.credits}，覆盖 ${pct(manual.localCoverage)}`
              : " · 本地无 usage，无法对账"}
            {manual.note ? `。备注：${manual.note}` : ""}
          </Callout>
        )}

        {sub && sub.count === 0 && sub.reason && sub.reason !== "no-dir" && (
          <Callout tone="warning" title={`子代理账未汇总（${sub.reason}）`}>
            探测过的候选目录：{(sub.probedPaths ?? []).join("  |  ") || "（无）"}
          </Callout>
        )}

        {proxyAlarm && (
          <Callout tone="warning" title={`代理自动启动失败（${proxyAlarm.error}）`}>
            {proxyAlarm.error === "EADDRINUSE"
              ? `端口 ${proxyAlarm.port ?? "—"} 被占用，自定义模型将无法对话。请换一个空闲端口重启代理：${CLI} --setup-proxy --port <新端口>，并把模型 Base URL 改成新端口。`
              : `代理未就绪（${proxyAlarm.error}），自定义模型可能无法对话。请运行 ${CLI} --check-proxy 查看链路状态。`}
          </Callout>
        )}

        {r.proxy?.dormant && !proxyAlarm && (
          <Callout tone="info" title="代理长期空闲">
            代理已配置但超过 14 天没有记录到流量（可能你已改回官方模型）。如不再使用自定义模型，可运行{" "}
            {CLI} --stop-proxy 停用代理；保留也不影响官方模型。
          </Callout>
        )}

        {cwIsFallback && (
          <Callout tone="warning" title="上下文窗口为回退值 200K（未从 runtime-config / usage 反推 / ManualTruth 拿到真值）">
            本会话所有以窗口为分母的占比与「峰值建议」都可能偏大，而绝对 token 数（已改以 S 真值为底）不受影响。
            建议在 {"`.qoder-credits/overrides/<sessionId>.json`"} 里手工填 {"`contextWindow`"}（如 qwen3-max=1000000），或等一笔带 input_tokens+ratio 的往返写入转录后自动反推生效。
          </Callout>
        )}

        {hasUsage && netAdv && c.userContextLimit != null && (
          <Stack gap="component">
            <Callout
              tone={netAdv.tone}
              title={`你真实的上下文占用 ${pct(c.netUserRatio ?? c.peakUserRatio ?? 0)}（${human(curCtx)} / 阈值 ${human(c.userContextLimit)}・${limitSrcLabel}）`}
            >
              {netAdv.text}
              {limitIsDefault && (
                <Text tone="secondary">
                  {` ⚙ 这里的 ${human(c.userContextLimit)} 是插件内置默认值，不是你在 Qoder「模型管理」里设的真实上限（插件读不到那个设置）。想按真实阈值算：在 ~/.qoder-credits-proxy/config.json 填 "userContextLimit": <你的上限>（对所有会话生效），或对本会话在 .qoder-credits/overrides/<会话id>.json 填同名字段，重跑报告即生效。`}
                </Text>
              )}
            </Callout>
            {ctxRows.length > 0 && (
              <Table
                headers={["对比口径", "数值", "说明"]}
                rows={ctxRows}
                density="compact"
              />
            )}
          </Stack>
        )}

        {c.thresholdNotEnforced && (
          <Callout tone="warning" title="⚠ 自动压缩不会在你设的阈值触发（本条最重要）">
            你的模型物理窗口是 {cwText}，Qoder 的自动压缩要等上下文涨到窗口 ~85%（≈{human(Math.round(c.contextWindow * 0.85))}）才触发；
            你在模型管理里设的 {human(c.userContextLimit)} 上限远在其下，永远不会触发自动压缩。
            请照上面「你真实的上下文占用」那条，到点自己手动压缩，别等它自动压。
          </Callout>
        )}

        {lh && (
          <Callout tone={lhTone} title="链路健康度">
            {lhText}
          </Callout>
        )}

        <Callout tone="info" title="度量口径">
          计费输入总量逐笔锁定真值（优先级：代理 promptTokens &gt; 转录 usage.input_tokens &gt; ratio{availTag(av, "contextRatio")} × {cwText}
          {cwIsFallback ? "，未拿到真窗口、全部 token 数字随之带 ≈" : ""}）；各类别/文件按块估算规模比例分摊
          {availTag(av, "categoryShare", "derived")}。{identityText}
          {cachedText ? ` ${cachedText}` : ""}
          {covPartial
            ? ` Credits 只来自 ${cov!.trips}/${cov!.roundTrips} 笔往返（占计费输入 ${pct(cov!.tokenShare)}），其余往返走代理实测、不经 Qoder 计费，故不要拿 Credits 去除以计费输入总量算单价。`
            : ""}
        </Callout>

        {byReq.length > 0 && (
          <ReportSection
            title="逐请求明细（每一次往返）"
            description={
              showCreditsChart
                ? "每个 round-trip 的真实输入规模与 credits；曲线骤降处为上下文压缩重置（顶部四项为会话累计，此处为每一次）"
                : `每个 round-trip 的真实输入规模；曲线骤降处为上下文压缩重置。credits 曲线未画：本会话只有 ${cov?.trips ?? 0}/${cov?.roundTrips ?? byReq.length} 笔往返带 credits（其余走代理实测、不经 Qoder 计费），画出来是一地零。`
            }
            meta={`${byReq.length} 次往返 · 压缩 ${orDash(s.compactions, av, "compactions")} 次`}
            divided
          >
            {showCreditsChart ? (
              <ChartComparisonGrid>
                <ChartContainer title="每次输入 tokens" ariaLabel="每次输入 tokens">
                  <LineChart
                    categories={reqLabels}
                    series={[{ name: "输入 tokens", data: reqInputs, tone: "info" }]}
                    height={220}
                    valueFormatter={human}
                    ariaLabel="每次请求输入 tokens"
                  />
                </ChartContainer>
                <ChartContainer title="每次 credits" ariaLabel="每次 credits">
                  <LineChart
                    categories={reqLabels}
                    series={[{ name: "credits", data: reqCredits, tone: "warning" }]}
                    height={220}
                    ariaLabel="每次请求 credits"
                  />
                </ChartContainer>
              </ChartComparisonGrid>
            ) : (
              <ChartContainer title="每次输入 tokens" ariaLabel="每次输入 tokens">
                <LineChart
                  categories={reqLabels}
                  series={[{ name: "输入 tokens", data: reqInputs, tone: "info" }]}
                  height={220}
                  valueFormatter={human}
                  ariaLabel="每次请求输入 tokens"
                />
              </ChartContainer>
            )}
          </ReportSection>
        )}

        {hasUsage && ccItems.length > 0 && (
          <ReportSection
            title="压缩单笔成本（会话里最贵的那几笔调用）"
            description="每次压缩本身就是一笔普通模型调用：整份上下文当 prompt 进去、摘要当 completion 出来。此前报告只显示「压缩 N 次」，把单笔最贵的开销藏成了一个计数。「省下」= 压缩前规模 − 压缩后首轮实测输入（地板）。口径列：实测=能在代理日志里唯一对上的供应商真值；自估=客户端在压缩边界里写的前后规模。"
            meta={`${ccItems.length} 次 · 输入累计 ${human(ccost?.totals.preTokens ?? 0)} · 摘要累计 ${human(ccost?.totals.postTokens ?? 0)} · 累计省下 ${human(ccost?.totals.savedTokens ?? 0)} · 其中 ${ccost?.totals.measured ?? 0} 笔为供应商实测`}
            divided
          >
            <Table
              headers={["第几次", "时刻", "触发", "输入", "摘要输出", "压缩后首轮", "省下", "耗时", "口径"]}
              rows={compactRows}
              density="compact"
              stickyHeader
            />
          </ReportSection>
        )}

        {sub && subItems.length > 0 && (
          <ReportSection
            title="子代理账（Agent 派发）"
            description="子代理的每次往返只写进它自己的独立转录，不计入上方主链任何数字；官方 UI 的一场会话扣费 = 主链 + 各子代理。"
            meta={`${subItems.length} 个子代理 · 主链 ${t.credits} + 子代理 ${sub.totals.credits} = 合计 ${sub.combined.credits} Credits`}
            divided
          >
            <Table
              headers={["子代理", "类型", "往返", "计费输入", "峰值占比", "Credits", "原价", "备注"]}
              rows={subRows}
              rowTone={subTones}
              density="compact"
              stickyHeader
            />
          </ReportSection>
        )}

        {hasUsage && r.byCategory.length > 0 && (
          <ReportSection
            title="按类别占比"
            description={`会话计费输入 token 在各来源间的分布（完整划分，占比之和 = 100%）${sysNote}`}
            meta={human(t.billedInputTokens) + ` tokens${availTag(av, "categoryShare", "derived")}`}
            divided
          >
            <ChartContainer ariaLabel="按类别占比">
              <PieChart donut data={pieData} centerLabel="计费输入" valueFormatter={human} />
            </ChartContainer>
          </ReportSection>
        )}

        {hasUsage && catDetail.length > 0 && (
          <ReportSection
            title="按类别下钻（工具 / 文件路径）"
            description="每个类别的消耗再拆到工具与具体文件/路径：工具返回、工具调用可精确到路径，其余类别为整体（无文件归属）。数值均为重发计费 token。"
            meta={`占总额=占计费输入总量 · 占本类=占该类别 · 程数=存活往返累计${availTag(av, "fileShare", "derived")}`}
            divided
          >
            <Table
              headers={["类别", "工具", "文件 / 路径", "重发 tokens", "占总额", "占本类", "程数"]}
              rows={detailRows}
              rowTone={detailTones}
              density="compact"
              stickyHeader
            />
          </ReportSection>
        )}

        {hasUsage && tools.length > 0 && (
          <ReportSection
            title="按工具占比"
            description="各工具相关内容（调用参数 + 返回）重发累计的计费 token 占比（仅工具相关块，非完整划分，占比之和 < 100%）。「单次」= 平均每次调用带来的重发 token：总量榜会把「次数少但每次极贵」的工具埋掉，这一列专门把它捞出来。"
            meta={`token 占比${availTag(av, "toolShare", "derived")} · 调用次数为实测`}
            divided
          >
            <Stack gap="component">
              <ChartContainer ariaLabel="按工具占比">
                <BarChart horizontal categories={toolCategories} series={toolSeries} valueFormatter={human} ariaLabel="按工具占比" />
              </ChartContainer>
              <Table
                headers={["工具", "重发 tokens", "占比", "调用", "单次"]}
                rows={toolRows}
                density="compact"
                stickyHeader
              />
            </Stack>
          </ReportSection>
        )}

        {hasUsage && fileRows.length > 0 && (
          <ReportSection
            title="按文件占比"
            description="精确到路径/文件名：内容随上下文被重复发送累计的计费 token 占比（Top 20，仅可归因文件的块）。「单次读取」= 这个文件平均每次被读取最终烧掉多少（含此后每一程的重发）——读一次就烧掉十几万的文件，在按总量排序的榜上毫不起眼。"
            meta={`程数=存活往返累计 · 读取=返回次数（实测）${availTag(av, "fileShare", "derived")}`}
            divided
          >
            <Table
              headers={["文件", "种类", "重发 tokens", "占比", "单次读取", "程数", "读取"]}
              rows={fileRows}
              density="compact"
              stickyHeader
            />
          </ReportSection>
        )}

        {!hasUsage && residueRows.length > 0 && (
          <ReportSection
            title="工具调用与文件读取（计数为实测）"
            description="占比与 token 一律不可用，但 tool_use 块两种转录都写，所以「谁被调了几次、谁被读了几次」仍是真值 —— IDE 端不是一无所有。"
            meta={`${t.toolCalls ?? 0} 次工具调用${availTag(av, "toolCalls")} · ${t.fileReads ?? 0} 次文件读取${availTag(av, "fileReads")} · ${s.turns} 轮对话`}
            divided
          >
            <Table
              headers={["工具 / 文件", "种类", "调用", "读取", "程数"]}
              rows={residueRows}
              density="compact"
              stickyHeader
            />
          </ReportSection>
        )}
      </Stack>
    </ReportShell>
  );
}
