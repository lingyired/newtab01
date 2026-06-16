# Tasks

- [x] Task 1: 创建 `.trae/rules/project_rules.md`，迁移 AI 助手行为指令
  - [x] SubTask 1.1: 从 CLAUDE.md 第 8 节提取 AI 行为指令内容
  - [x] SubTask 1.2: 精简 8.6 Frontend Skill 中与 marketing 页相关的规则，只保留 newtab01 产品 UI 原则
  - [x] SubTask 1.3: 精简 8.5 常用组件选型表为项目实际使用的组件
  - [x] SubTask 1.4: 写入 `.trae/rules/project_rules.md`

- [x] Task 2: 修正 CLAUDE.md 编号错误
  - [x] SubTask 2.1: 补充 1.2 非目标
  - [x] SubTask 2.2: 补充 2.2 拖拽排序与布局管理
  - [x] SubTask 2.3: 将原 4 节内的 5.1 改为 4.1
  - [x] SubTask 2.4: 修正第 10 节引用的 "10.2" 为实际存在的编号

- [x] Task 3: 更新 CLAUDE.md 过时信息
  - [x] SubTask 3.1: 更新 Manifest V3 示例（版本号、host_permissions）
  - [x] SubTask 3.2: 将 split.html 相关描述改为 ?split=1 URL 参数方式
  - [x] SubTask 3.3: 更新 5.3 上下文矩阵，移除 Split 独立入口行
  - [x] SubTask 3.4: 更新 4.1 iframe 分屏实现要点中的 URL 传参方式

- [x] Task 4: 补充 CLAUDE.md 缺失内容
  - [x] SubTask 4.1: 在技术栈表中补充 zustand、react-hook-form、zod、dnd-kit、@tanstack/react-virtual
  - [x] SubTask 4.2: 编写 1.2 非目标内容
  - [x] SubTask 4.3: 编写 2.2 拖拽排序与布局管理内容

- [x] Task 5: 消除冗余与修正逻辑不一致
  - [x] SubTask 5.1: 统一 SplitEngine 和 SplitEngineManager.open 的参数类型
  - [x] SubTask 5.2: 修正 popup 描述矛盾（Dialog vs 独立 popup.html）
  - [x] SubTask 5.3: 统一 framer-motion 用量描述
  - [x] SubTask 5.4: 去重"禁用 bg-blue-500"规则，只在 9.2 保留
  - [x] SubTask 5.5: 将原第 8 节替换为一条引用说明指向 `.trae/rules/project_rules.md`

# Task Dependencies
- [Task 1] must complete before [Task 5 SubTask 5.5]（先迁移内容，再替换引用）
- [Task 2] and [Task 3] and [Task 4] can run in parallel
- [Task 5] depends on [Task 1] for SubTask 5.5 only; other subtasks can run in parallel
