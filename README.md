# PairBite - 情侣小厨房

一个为情侣设计的微信小程序，帮助两个人一起管理菜品、每日点菜、记录饮食生活。

基于微信云开发，零服务器、零运维，开箱即用。部署后可邀请多对情侣共同使用，数据自动隔离。

## 功能概览

- **伴侣绑定**：通过邀请码配对，数据自动双向同步
- **菜品库管理**：添加/编辑菜品，支持分类、图片、描述
- **每日点菜**：从菜品库选菜下单，支持备注，伴侣实时收到通知
- **历史记录**：查看所有点菜历史，支持"再来一单"快速复用
- **分类管理**：自定义菜品分类（荤菜/素菜/汤品/主食等），支持排序
- **订阅通知**：点菜后自动向伴侣推送微信订阅消息
- **厨房命名**：自定义小厨房名称，双方同步显示

## 技术栈

| 层 | 技术 | 说明 |
|---|------|------|
| 前端 | 微信小程序原生 | WXML + WXSS + JS |
| UI | WeUI | 微信官方组件库 |
| 后端 | 微信云函数 | Node.js + wx-server-sdk |
| 数据库 | 微信云数据库 | NoSQL 文档数据库 |
| 存储 | 微信云存储 | 菜品图片 |
| 通知 | 微信订阅消息 | 点菜/新菜品通知 |

无任何第三方 API 依赖，完全运行在微信云开发生态内。

## 项目结构

```
├── miniprogram/                # 小程序前端
│   ├── app.js                  # 全局逻辑（用户管理、绑定守卫、云初始化）
│   ├── app.json                # 页面路由与 TabBar 配置
│   ├── app.wxss                # 全局样式
│   ├── envList.js              # 云环境配置 ← 需要修改
│   ├── components/
│   │   └── bind-guard/         # 绑定状态提醒组件
│   └── pages/
│       ├── MainPage/           # 首页（情侣卡片、今日点菜、快捷入口）
│       ├── Order/              # 点菜页（分类选菜、购物车）
│       ├── Dishes/             # 菜品库浏览
│       ├── DishAdd/            # 添加/编辑菜品
│       ├── DishDetail/         # 菜品详情
│       ├── OrderHistory/       # 历史记录
│       ├── OrderDetail/        # 订单详情
│       ├── Bind/               # 伴侣绑定
│       ├── Settings/           # 个人设置
│       └── CategoryManage/     # 分类管理
├── cloudfunctions/             # 云函数（后端）
│   ├── createUser/             # 用户注册/登录，生成邀请码
│   ├── bindPartner/            # 伴侣配对绑定
│   ├── unbindPartner/          # 解除绑定
│   ├── getCoupleData/          # 查询伴侣共享数据
│   ├── updateCoupleData/       # 更新/删除共享数据
│   ├── manageCategory/         # 分类管理（增删改查 + 默认初始化）
│   ├── updateKitchenName/      # 更新厨房名称
│   ├── sendNotify/             # 发送订阅消息通知
│   └── getOpenId/              # 获取用户 OpenID
├── project.config.json         # 微信开发者工具配置 ← 需要修改
└── LICENSE
```

## 部署指南

### 前置条件

- 安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
- 注册一个微信小程序账号（[个人号即可](https://mp.weixin.qq.com/wxopen/waregister?action=step1&source=mpregister&token=&lang=zh_CN)）

### 第一步：克隆项目

```bash
git clone https://github.com/630999Steven/PairBite.git
```

### 第二步：开通云开发

1. 用微信开发者工具打开项目
2. 点击工具栏「云开发」按钮
3. 按提示开通云开发环境（选免费基础版即可）
4. 记下你的 **云环境 ID**（格式类似 `cloud1-xxxxxxxxxx`）

### 第三步：修改配置

需要修改两个文件：

**project.config.json** — 替换成你的小程序 AppID：

```json
"appid": "你的小程序AppID"
```

> AppID 在 [微信公众平台](https://mp.weixin.qq.com/) → 开发管理 → 开发设置 中查看

**miniprogram/envList.js** — 替换成你的云环境 ID：

```javascript
const envList = [
  {
    "envId": "你的云环境ID",
    "alias": "cloud"
  }
]
```

### 第四步：上传云函数

在微信开发者工具中，对 `cloudfunctions/` 下的**每个云函数文件夹**执行：

1. 右键文件夹 → 「在终端中打开」→ 执行 `npm install`
2. 右键文件夹 → 「上传并部署：云端安装依赖」

共 9 个云函数需要部署：

| 云函数 | 功能 |
|--------|------|
| createUser | 用户注册/登录 |
| bindPartner | 伴侣绑定 |
| unbindPartner | 解除绑定 |
| getCoupleData | 查询共享数据 |
| updateCoupleData | 更新共享数据 |
| manageCategory | 分类管理 |
| updateKitchenName | 厨房命名 |
| sendNotify | 消息通知 |
| getOpenId | 获取 OpenID |

### 第五步：配置订阅消息模板（可选）

如果需要点菜通知功能：

1. 登录 [微信公众平台](https://mp.weixin.qq.com/) → 功能 → 订阅消息 → 添加模板
2. 搜索并选择包含以下字段的模板：时间、任务名称、内容、备注
3. 获取模板 ID 后，替换 `miniprogram/app.js` 中 `globalData.notifyTmplIds` 的值

> 不配置此步骤不影响核心功能使用，只是不会推送通知。

### 第六步：运行

点击微信开发者工具的「编译」按钮即可在模拟器中预览。

真机测试：点击「上传」将代码上传为体验版，然后在微信公众平台添加体验成员即可使用，**无需提交审核上架**。

### 第七步：邀请体验成员

小程序未正式上线前，其他用户需要被添加为**体验成员**才能访问：

1. 登录 [微信公众平台](https://mp.weixin.qq.com/) → 管理 → 成员管理 → 体验成员
2. 点击「添加」，输入对方的微信号
3. 对方在微信中确认后，扫描体验版二维码即可使用

> 个人号最多可添加 15 名体验成员，足够多对情侣一起使用。每对情侣的数据通过 coupleId 隔离，互不干扰。

## 使用流程

1. **用户 A** 打开小程序 → 设置头像昵称 → 进入「绑定」页面获取邀请码
2. **用户 B** 打开小程序 → 设置头像昵称 → 输入 A 的邀请码完成绑定
3. 绑定成功后双方共享菜品库，可以互相点菜、查看记录

## 数据库说明

首次使用时，云函数会自动创建所需的数据库集合，**无需手动建表**。

| 集合 | 用途 | 数据隔离 |
|------|------|---------|
| User | 用户信息、绑定关系 | openid |
| DishList | 菜品库 | coupleId |
| OrderList | 点菜记录 | coupleId |
| Category | 菜品分类 | coupleId |

每对情侣通过 `coupleId` 隔离数据，多对情侣共用同一个小程序互不干扰。

## 云开发免费额度

| 资源 | 免费额度 |
|------|---------|
| 数据库存储 | 2 GB |
| 数据库读次数 | 50 万次/天 |
| 云存储容量 | 5 GB |
| 云函数调用 | 40 万次/月 |

情侣日常使用完全在免费额度内。

## 常见问题

**Q：必须要两个人才能用吗？**
A：绑定伴侣后才能使用菜品和点菜功能。单人打开可以看到设置和绑定页面。

**Q：如何换绑伴侣？**
A：在设置页面解除绑定后，重新使用新的邀请码绑定即可。解绑后原有菜品和订单数据仍然保留在原 coupleId 下。

**Q：云函数部署报错怎么办？**
A：确保先在云函数目录下执行了 `npm install`，再上传部署。如果仍报错，检查 Node.js 版本是否 >= 12。

**Q：订阅消息收不到？**
A：微信订阅消息需要用户主动点击授权才能发送，且每次授权只能发一条。这是微信平台的限制。

## 贡献

欢迎提交 Issue 和 Pull Request。

## License

本项目采用 [CC BY-NC-SA 4.0](LICENSE) 协议开源。

- 允许自由使用、修改和分享
- **禁止商业用途**
- 修改后的作品须以相同协议分享
- 须注明原作者
