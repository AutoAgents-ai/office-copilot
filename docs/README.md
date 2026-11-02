# Office Copilot 产品设计

本目录包含 Office 文档工作台的产品需求与可交互原型。

| 文件 | 说明 |
| --- | --- |
| [PRD.md](PRD.md) | 产品需求文档：定位、用户、功能、交互、DSH Copilot、数据模型、架构、验收 |
| [prototype/index.html](prototype/index.html) | 零依赖 HTML 交互原型，直接用浏览器打开 |
| [prototype/README.md](prototype/README.md) | 原型运行方式、演示脚本、交互地图与边界 |
| [screenshots/](screenshots/) | 原型关键页面截图（PR 评审用） |

## 快速开始

```bash
open docs/prototype/index.html
```

建议窗口宽度 1280px 以上。

## 原型演示路径

1. 首页 → 点击「新建文档」。
2. 选择「演示文稿」→ 选择「季度业务汇报」模板 → 选择主题 → 创建。
3. 在右侧 Copilot 输入需求，观察工具调用与流式生成。
4. 点击产物卡片「应用」→ 左侧幻灯片更新 → 顶栏「撤销」。
5. 点击「导出」选择 `.pptx`，查看导出流程（交互模拟）。
6. 回到首页 → 模板中心 → 打开 Word/Excel 工作台体验类型切换。
