// 全局页面绑定拦截器 —— 白名单之外的页面自动校验绑定状态
const _originalPage = Page
const _bindWhitelist = ['pages/MainPage/index', 'pages/Settings/index', 'pages/Bind/index']

Page = function(options) {
  const originalOnShow = options.onShow
  options.onShow = function(...args) {
    const app = getApp()
    const pages = getCurrentPages()
    const route = pages[pages.length - 1]?.route || ''
    const whitelisted = _bindWhitelist.some(w => route.includes(w))

    if (!whitelisted && app && app.bindGuard && !app.bindGuard(this)) {
      return
    }

    if (originalOnShow) {
      return originalOnShow.apply(this, args)
    }
  }
  _originalPage(options)
}

App({
  async onLaunch() {
    this.initcloud()

    this.globalData = {
      // 当前用户信息（动态获取）
      currentUser: null,
      // 伴侣信息（动态获取）
      partner: null,
      // 用户信息是否已加载
      userLoaded: false,
      // 用户信息加载Promise
      userLoadPromise: null,

      // 云数据库集合名称
      collectionDishList: 'DishList',
      collectionOrderList: 'OrderList',

      // 应用信息
      appName: '帕恰狗的小厨房',
      version: '1.0.0',

      // 订阅消息模板ID
      notifyTmplIds: ['your-template-id'],

      // 菜品分类（从数据库动态加载）
      categories: [],
      categoriesLoaded: false,
    }
  },

  flag: false,

  /**
   * 初始化云开发环境
   */
  async initcloud() {
    const normalinfo = require('./envList.js').envList || []
    if (normalinfo.length != 0 && normalinfo[0].envId != null) {
      wx.cloud.init({
        traceUser: true,
        env: normalinfo[0].envId
      })
      this.cloud = () => {
        return wx.cloud
      }
    } else {
      this.cloud = () => {
        wx.showModal({
          content: '帕恰狗找不到云环境啦~',
          showCancel: false
        })
        throw new Error('无云开发环境')
      }
    }
  },

  // 获取云数据库实例
  async database() {
    return (await this.cloud()).database()
  },

  // 加载用户信息（带缓存）
  async loadUserInfo(forceRefresh = false) {
    // 如果已加载且不强制刷新，直接返回
    if (this.globalData.userLoaded && !forceRefresh) {
      return {
        currentUser: this.globalData.currentUser,
        partner: this.globalData.partner
      }
    }

    // 如果正在加载中，等待加载完成
    if (this.globalData.userLoadPromise && !forceRefresh) {
      return this.globalData.userLoadPromise
    }

    // 开始加载
    this.globalData.userLoadPromise = this._doLoadUserInfo()
    return this.globalData.userLoadPromise
  },

  // 实际加载用户信息
  async _doLoadUserInfo() {
    try {
      const res = await wx.cloud.callFunction({ name: 'createUser' })
      if (res.result && res.result.success) {
        // 转换头像为临时链接
        const avatarIds = [res.result.user?.avatarUrl, res.result.partner?.avatarUrl].filter(u => u && u.startsWith('cloud://'))
        if (avatarIds.length > 0) {
          const urlMap = await this.getTempFileURLs(avatarIds)
          if (res.result.user?.avatarUrl && urlMap[res.result.user.avatarUrl]) {
            res.result.user.avatarUrl = urlMap[res.result.user.avatarUrl]
          }
          if (res.result.partner?.avatarUrl && urlMap[res.result.partner.avatarUrl]) {
            res.result.partner.avatarUrl = urlMap[res.result.partner.avatarUrl]
          }
        }
        this.globalData.currentUser = res.result.user
        this.globalData.partner = res.result.partner
        this.globalData.userLoaded = true
        // 已绑定时加载分类
        if (res.result.user?.bindStatus === 'bound') {
          await this.loadCategories()
        }
        return {
          currentUser: res.result.user,
          partner: res.result.partner
        }
      }
    } catch (e) {
      console.error('load user info error', e)
    }
    return { currentUser: null, partner: null }
  },

  // 加载分类数据
  async loadCategories(forceRefresh = false) {
    if (this.globalData.categoriesLoaded && !forceRefresh) {
      return this.globalData.categories
    }
    try {
      // 先确保初始化默认分类
      await wx.cloud.callFunction({
        name: 'manageCategory',
        data: { action: 'init' }
      })
      // 加载分类列表
      const res = await wx.cloud.callFunction({
        name: 'manageCategory',
        data: { action: 'list' }
      })
      if (res.result?.success) {
        this.globalData.categories = res.result.data
        this.globalData.categoriesLoaded = true
        return res.result.data
      }
    } catch (e) {
      console.error('load categories error', e)
    }
    return []
  },

  // 更新用户昵称
  async updateNickname(nickname) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'createUser',
        data: { nickname }
      })
      if (res.result && res.result.success) {
        this.globalData.currentUser = res.result.user
        return true
      }
    } catch (e) {
      console.error('update nickname error', e)
    }
    return false
  },

  // 绑定伴侣
  async bindPartner(inviteCode) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'bindPartner',
        data: { inviteCode }
      })
      if (res.result && res.result.success) {
        // 刷新用户信息（会自动加载分类）
        await this.loadUserInfo(true)
        return { success: true, partner: res.result.partner }
      }
      return { success: false, message: res.result?.message || '绑定失败' }
    } catch (e) {
      console.error('bind partner error', e)
      return { success: false, message: '绑定失败，请重试' }
    }
  },

  // 解除绑定
  async unbindPartner() {
    try {
      const res = await wx.cloud.callFunction({ name: 'unbindPartner' })
      if (res.result && res.result.success) {
        this.globalData.partner = null
        if (this.globalData.currentUser) {
          this.globalData.currentUser.partnerId = ''
          this.globalData.currentUser.bindStatus = 'unbound'
          this.globalData.currentUser.coupleId = ''
        }
        return { success: true }
      }
      return { success: false, message: res.result?.message || '解绑失败' }
    } catch (e) {
      console.error('unbind partner error', e)
      return { success: false, message: '解绑失败，请重试' }
    }
  },

  // 检查是否已绑定伴侣
  isBound() {
    return this.globalData.currentUser?.bindStatus === 'bound' && this.globalData.partner
  },

  // 检查用户信息是否完整（有昵称和头像）
  isProfileComplete() {
    const user = this.globalData.currentUser
    return user?.nickname && user?.avatarUrl
  },

  // 页面绑定守卫：仅设置绑定状态到页面 data，不拦截页面展示
  bindGuard(page) {
    page.setData({ isBound: this.isBound() })
    return true
  },

  // 获取伴侣名字
  getPartnerName() {
    return this.globalData.partner?.nickname || '对方'
  },

  // 获取当前用户名字
  getCurrentUserName() {
    return this.globalData.currentUser?.nickname || '我'
  },

  // 根据 openid 获取显示名称
  getDisplayName(openid) {
    if (openid === this.globalData.currentUser?._id) {
      return '你'
    }
    if (openid === this.globalData.partner?.openid) {
      return this.globalData.partner?.nickname || '对方'
    }
    return '未知'
  },

  // 获取厨房名称（自定义或默认）
  getKitchenName() {
    return this.globalData.currentUser?.kitchenName || this.globalData.appName
  },

  // 设置页面导航栏标题为厨房名称
  setKitchenTitle() {
    const title = this.getKitchenName()
    wx.setNavigationBarTitle({ title })
  },

  // 临时链接缓存（fileID -> { url, expireTime }）
  _tempUrlCache: {},

  // 批量将 cloud:// fileID 转为临时链接
  async getTempFileURLs(fileIds) {
    if (!fileIds || fileIds.length === 0) return {}

    const now = Date.now()
    const result = {}
    const needFetch = []

    for (const id of fileIds) {
      if (!id || !id.startsWith('cloud://')) continue;
      const cached = this._tempUrlCache[id]
      if (cached && cached.expireTime > now) {
        result[id] = cached.url
      } else {
        needFetch.push(id)
      }
    }

    if (needFetch.length > 0) {
      try {
        const res = await wx.cloud.callFunction({
          name: 'getFileURL',
          data: { fileList: needFetch }
        })
        if (res.result?.success) {
          for (const item of res.result.fileList) {
            if (item.tempFileURL) {
              result[item.fileID] = item.tempFileURL
              // 缓存 1.5 小时（临时链接有效期约 2 小时）
              this._tempUrlCache[item.fileID] = {
                url: item.tempFileURL,
                expireTime: now + 90 * 60 * 1000
              }
            }
          }
        }
      } catch (e) {
        console.error('getTempFileURLs error', e)
      }
    }

    return result
  },

  // 批量转换数组中对象的指定字段为临时链接，原始值保留到 _raw_xxx
  async convertFileURLs(items, fields) {
    const allIds = []
    for (const item of items) {
      for (const field of fields) {
        const val = item[field]
        if (val && val.startsWith('cloud://')) allIds.push(val)
      }
    }
    const urlMap = await this.getTempFileURLs(allIds)
    for (const item of items) {
      for (const field of fields) {
        const raw = item[field]
        if (urlMap[raw] && urlMap[raw] !== raw) {
          item['_raw_' + field] = raw
          item[field] = urlMap[raw]
        }
      }
    }
    return items
  },

  // 更新厨房名称（同步到伴侣）
  async updateKitchenName(name) {
    if (!name || name.length > 8) {
      return { success: false, message: '名称不能超过8个字' }
    }
    try {
      const res = await wx.cloud.callFunction({
        name: 'updateKitchenName',
        data: { kitchenName: name }
      })
      if (res.result?.success) {
        this.globalData.currentUser.kitchenName = name
        return { success: true }
      }
      return { success: false, message: res.result?.message || '更新失败' }
    } catch (e) {
      console.error('update kitchen name error', e)
      return { success: false, message: '更新失败' }
    }
  },
})
