# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

PairBite（帕恰狗的小厨房）— 情侣共享菜品管理微信小程序。基于微信云开发（云函数 + 云数据库 + 云存储），无第三方后端依赖。

## 开发环境

使用**微信开发者工具**打开项目根目录。无构建命令、无测试套件、无 CI。

- 前端 npm 依赖（仅 weui-miniprogram）已预构建在 `miniprogram/miniprogram_npm/`，一般无需重新安装
- 若需重新构建：在 `miniprogram/` 下 `npm install`，然后开发者工具「工具 → 构建 npm」
- 云函数部署：右键云函数文件夹 →「上传并部署：云端安装依赖」（云端自动 npm install）

## 架构

### 前后端分层

```
miniprogram/          前端 — 微信原生小程序（WXML + WXSS + JS）
cloudfunctions/       后端 — 9 个独立云函数，各自 package.json，统一依赖 wx-server-sdk
```

### 数据隔离模型

核心概念是 `coupleId`（两个 openid 排序拼接）。绑定后所有业务数据（菜品、订单、分类）都挂在 coupleId 下，实现情侣间共享、不同情侣间隔离。

### 云数据库集合

| 集合 | _id | 隔离键 | 用途 |
|------|-----|--------|------|
| User | openid | — | 用户信息、绑定关系、邀请码 |
| DishList | auto | coupleId | 菜品库 |
| OrderList | auto | coupleId | 点菜记录 |
| Category | auto | coupleId | 自定义分类（首次绑定自动初始化默认分类） |

### 云函数职责

- `getCoupleData` / `updateCoupleData` — 通用 CRUD，前端传 collection + action，云函数校验 coupleId 权限后执行
- `createUser` — 注册/登录合一，幂等，自动生成 6 位邀请码
- `bindPartner` / `unbindPartner` — 双向绑定/解绑
- `manageCategory` — 分类增删改查 + 首次初始化默认分类 + 旧数据迁移
- `sendNotify` — 通过微信订阅消息向伴侣推送通知
- `getOpenId` — 获取用户 OpenID

### 前端关键机制

- **全局绑定拦截器**（`app.js` 顶部）：重写 `Page()` 函数，在 `onShow` 中自动校验绑定状态。白名单页面：MainPage、Settings、Bind
- **bind-guard 组件**：全局注册的非阻断式顶部提醒条，检测未完善资料或未绑定状态
- **全局状态**：`app.globalData` 管理用户信息、伴侣信息、分类缓存。页面通过 `app.loadUserInfo()` / `app.loadCategories()` 获取（带缓存和 Promise 去重）
- **数据交互模式**：页面直接调 `wx.cloud.callFunction` 或通过 `app.database()` 直接读写云数据库（OrderList 的写入在前端完成）

### 配置文件

- `miniprogram/envList.js` — 云环境 ID
- `project.config.json` — 小程序 AppID
- `app.js` 中 `notifyTmplIds` — 订阅消息模板 ID

### 主题色

绿色主题（帕恰狗），CSS 变量定义在 `app.wxss`，主色 `--primary-color: #6FCF97`。

### TabBar 四个入口

首页（MainPage）→ 点菜（Order）→ 菜品库（Dishes）→ 历史（OrderHistory）

## 注意事项

- 云函数使用 `cloud.DYNAMIC_CURRENT_ENV` 自动匹配环境，不要硬编码环境 ID
- 云数据库单次查询上限 100 条（微信平台限制），分页需用 skip + limit
- `sendNotify` 中的模板 ID 和 `app.js` 中的 `notifyTmplIds` 是两个不同的值（云端 vs 前端授权用），需各自配置
