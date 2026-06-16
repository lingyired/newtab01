# CLAUDE.md 审视与修订 Spec

## Why
CLAUDE.md 存在编号错误、内容缺失、过时信息、冗余重复、文档定位模糊等问题，需要系统性修订以提升准确性和可维护性。

## What Changes
- **拆分文档**：将 AI 助手行为指令（原第 8 节）从 CLAUDE.md 拆出，移至 `.trae/rules/project_rules.md`
- **修正编号**：补 2.2、1.2，修正 4.1/5.1 冲突，修正 10.2 引用
- **补充缺失内容**：2.2 拖拽排序与布局管理、1.2 非目标、技术栈遗漏项
- **更新过时信息**：Manifest 版本号、split 实现方式、host_permissions、上下文矩阵
- **消除冗余**：去重 Skill 触发矩阵、bg-blue-500 规则、8.5 与 9.2 重叠
- **修正逻辑不一致**：SplitEngine 接口参数、popup 描述矛盾、framer-motion 用量矛盾
- **精简不相关内容**：移除 marketing 页设计规则、精简组件选型表

## Impact
- Affected code: `CLAUDE.md`（主改）、`.trae/rules/project_rules.md`（新建）
- AI 助手行为：规则从 CLAUDE.md 迁移到 `.trae/rules/`，Trae IDE 会自动读取

---

## ADDED Requirements

### Requirement: 文档拆分
CLAUDE.md SHALL 只保留项目设计规格内容（架构、功能、技术栈、工程约束等），AI 助手行为指令 SHALL 迁移至 `.trae/rules/project_rules.md`。

#### Scenario: AI 助手读取规则
- **WHEN** AI 助手在 Trae IDE 中处理本项目任务
- **THEN** 自动从 `.trae/rules/project_rules.md` 读取行为指令，无需在 CLAUDE.md 中重复

### Requirement: 编号修正
文档章节编号 SHALL 连续且无冲突。

#### Scenario: 五大新增能力编号
- **WHEN** 查看第 2 节
- **THEN** 子节编号为 2.1、2.2、2.3、2.4、2.5，无跳跃

#### Scenario: 分屏引擎子节归属
- **WHEN** 查看第 4 节 iframe 分屏实现要点
- **THEN** 其编号为 4.1，不与第 5 节冲突

### Requirement: 补充缺失内容
文档 SHALL 包含完整的非目标定义、五大能力描述和技术栈。

#### Scenario: 非目标定义
- **WHEN** 查看第 1 节
- **THEN** 1.2 非目标明确列出项目不做的事

#### Scenario: 拖拽排序能力
- **WHEN** 查看第 2 节
- **THEN** 2.2 描述拖拽排序与布局管理能力

#### Scenario: 技术栈完整性
- **WHEN** 查看第 3 节技术栈表
- **THEN** 包含 zustand、react-hook-form、zod、dnd-kit 等实际使用的依赖

### Requirement: 过时信息同步
文档 SHALL 反映项目当前实际状态。

#### Scenario: Manifest 信息
- **WHEN** 查看 Manifest V3 示例
- **THEN** 版本号与实际一致，包含 host_permissions

#### Scenario: 分屏实现方式
- **WHEN** 查看分屏相关描述
- **THEN** 使用 `?split=1` URL 参数方式，而非独立 split.html

### Requirement: 消除冗余
同一规则 SHALL 只在一处定义，其他位置引用即可。

#### Scenario: 语义色规则
- **WHEN** 查看文档中"禁用 bg-blue-500"相关规则
- **THEN** 只在工程约束（9.2）中定义一次，其他位置引用

### Requirement: 逻辑一致性
文档内描述 SHALL 无自相矛盾。

#### Scenario: SplitEngine 接口一致性
- **WHEN** 查看 SplitEngine 和 SplitEngineManager 的 open 方法签名
- **THEN** 参数类型一致（均使用 SplitLayout 或 SplitMode，不混用）

#### Scenario: framer-motion 用量描述
- **WHEN** 查看动效相关描述
- **THEN** 技术栈表和设计原则中的描述一致，不矛盾

---

## MODIFIED Requirements

### Requirement: CLAUDE.md 结构
原第 8 节（编码原则与 Skill 体系）整体迁移至 `.trae/rules/project_rules.md`，CLAUDE.md 中仅保留一条引用说明指向该文件。

原第 9 节工程约束中与 AI 行为指令重叠的部分（如 shadcn 硬规则）保留在 CLAUDE.md，因为它们同时也是项目工程约束。

---

## REMOVED Requirements

### Requirement: Marketing 页设计规则
**Reason**: newtab01 是 Chrome 新标签页扩展，不涉及 marketing 页 / hero / landing page 设计，8.6 中大量相关规则（Full-bleed image、品牌名最大、hero card 等）与项目无关。
**Migration**: 如果未来需要产品官网，再单独创建设计文档。

### Requirement: 不适用的组件选型
**Reason**: 8.5 常用组件选型表中 Chart、Sidebar、NavigationMenu、Pagination 等组件在新标签页扩展中不太可能使用，造成误导。
**Migration**: 精简为项目实际使用的组件列表。
