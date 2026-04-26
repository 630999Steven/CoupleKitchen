const app = getApp()

Page({
  data: {
    pageLoading: true,
    greeting: '你好',
    userName: '',
    userAvatar: '',
    partnerName: '',
    partnerAvatar: '',
    bindDays: 0,
    todayOrder: null,
    dishCount: 0,
    orderCount: 0,
    togetherDays: 0,
    isBound: false,
    profileComplete: false,
  },

  // 是否已完成首次加载
  hasLoaded: false,

  onLoad(options) {
    this.setGreeting()
    // 如果携带了邀请码参数（从分享链接进入）
    if (options.inviteCode) {
      app.globalData.pendingInviteCode = options.inviteCode
    }
  },

  async onShow() {
    // 首次进入显示 loading，之后直接显示页面
    if (!this.hasLoaded) {
      this.setData({ pageLoading: true })
    }
    // 每次进入首页都强制刷新用户信息，确保绑定状态及时更新
    await app.loadUserInfo(true)
    await this.loadUserInfo()
    app.setKitchenTitle()
    if (!this.hasLoaded) {
      this.setData({ pageLoading: false })
      this.hasLoaded = true
    }
  },

  // 加载用户信息
  async loadUserInfo() {
    const { currentUser, partner } = await app.loadUserInfo()
    const isBound = app.isBound()
    const profileComplete = app.isProfileComplete()

    // 计算绑定天数
    let bindDays = 0
    if (isBound && currentUser?.bindTime) {
      const bindTime = new Date(currentUser.bindTime)
      const now = new Date()
      bindDays = Math.floor((now - bindTime) / (1000 * 60 * 60 * 24)) + 1
    }

    this.setData({
      userName: currentUser?.nickname || '',
      userAvatar: currentUser?.avatarUrl || '',
      partnerName: partner?.nickname || '',
      partnerAvatar: partner?.avatarUrl || '',
      bindDays,
      isBound,
      profileComplete
    })

    // 已绑定，加载其他数据
    if (isBound) {
      await Promise.all([
        this.loadTodayOrder(),
        this.loadStats()
      ])
    }
  },

  // 设置问候语
  setGreeting() {
    const hour = new Date().getHours()
    let greeting = '你好'
    if (hour < 6) greeting = '夜深了'
    else if (hour < 9) greeting = '早上好'
    else if (hour < 12) greeting = '上午好'
    else if (hour < 14) greeting = '中午好'
    else if (hour < 18) greeting = '下午好'
    else if (hour < 22) greeting = '晚上好'
    else greeting = '夜深了'
    this.setData({ greeting })
  },

  // 加载今日点菜
  async loadTodayOrder() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getCoupleData',
        data: {
          collection: app.globalData.collectionOrderList,
          todayOnly: true,
          orderBy: 'createTime',
          order: 'desc',
          limit: 1
        }
      })

      if (res.result?.success && res.result.data?.length > 0) {
        const order = res.result.data[0]
        const creatorName = app.getDisplayName(order._openid)
        this.setData({
          todayOrder: {
            ...order,
            creatorName,
            timeText: this.formatTime(order.createTime)
          }
        })
      } else {
        this.setData({ todayOrder: null })
      }
    } catch (e) {
      console.error('load today order error', e)
    }
  },

  // 加载统计数据
  async loadStats() {
    try {
      const [dishRes, orderRes] = await Promise.all([
        wx.cloud.callFunction({
          name: 'getCoupleData',
          data: { collection: app.globalData.collectionDishList, countOnly: true }
        }),
        wx.cloud.callFunction({
          name: 'getCoupleData',
          data: { collection: app.globalData.collectionOrderList, countOnly: true }
        })
      ])

      this.setData({
        dishCount: dishRes.result?.total || 0,
        orderCount: orderRes.result?.total || 0,
        togetherDays: (orderRes.result?.total || 0) > 0 ? Math.max(1, orderRes.result.total) : 0
      })
    } catch (e) {
      console.error('load stats error', e)
    }
  },

  // 格式化时间
  formatTime(date) {
    if (!date) return ''
    const d = new Date(date)
    const hours = d.getHours().toString().padStart(2, '0')
    const minutes = d.getMinutes().toString().padStart(2, '0')
    return `${hours}:${minutes}`
  },

  // 订阅消息
  async requestSubscribeMessage() {
    wx.requestSubscribeMessage({
      tmplIds: app.globalData.notifyTmplIds,
      success: (res) => {
        if (res[app.globalData.notifyTmplIds[0]] === 'accept') {
          wx.showToast({ title: '订阅成功', icon: 'success' })
        } else {
          wx.showToast({ title: '订阅失败', icon: 'none' })
        }
      },
      fail: (err) => {
        console.error('subscribe error', err)
        wx.showToast({ title: '请先申请消息模板', icon: 'none' })
      }
    })
  },

  // 跳转到点菜页
  goToOrder() {
    wx.switchTab({ url: '/pages/Order/index' })
  },

  // 跳转到今日订单详情
  goToTodayOrder() {
    if (!this.data.todayOrder?._id) return
    wx.navigateTo({ url: `/pages/OrderDetail/index?id=${this.data.todayOrder._id}` })
  },

  // 跳转到菜品库
  goToDishes() {
    wx.switchTab({ url: '/pages/Dishes/index' })
  },

  // 跳转到历史
  goToHistory() {
    wx.switchTab({ url: '/pages/OrderHistory/index' })
  },

  // 跳转到最近点菜记录
  goToRecentOrder() {
    wx.requestSubscribeMessage({
      tmplIds: app.globalData.notifyTmplIds,
      complete: async () => {
        try {
          const res = await wx.cloud.callFunction({
            name: 'getCoupleData',
            data: {
              collection: app.globalData.collectionOrderList,
              orderBy: 'createTime',
              order: 'desc',
              limit: 1
            }
          })
          if (res.result?.success && res.result.data?.length > 0) {
            const order = res.result.data[0]
            wx.navigateTo({ url: `/pages/OrderDetail/index?id=${order._id}` })
          } else {
            wx.switchTab({ url: '/pages/OrderHistory/index' })
          }
        } catch (e) {
          console.error('goToRecentOrder error', e)
          wx.switchTab({ url: '/pages/OrderHistory/index' })
        }
      }
    })
  },

  // 跳转到绑定页
  goToBind() {
    wx.requestSubscribeMessage({
      tmplIds: app.globalData.notifyTmplIds,
      complete: () => wx.navigateTo({ url: '/pages/Bind/index' })
    })
  },

  // 跳转到设置页
  goToSettings() {
    wx.requestSubscribeMessage({
      tmplIds: app.globalData.notifyTmplIds,
      complete: () => wx.navigateTo({ url: '/pages/Settings/index' })
    })
  },

  // 跳转到类目管理
  goToCategoryManage() {
    wx.requestSubscribeMessage({
      tmplIds: app.globalData.notifyTmplIds,
      complete: () => wx.navigateTo({ url: '/pages/CategoryManage/index' })
    })
  },

  // 跳转到设置 profile
  goToSetProfile() {
    wx.navigateTo({ url: '/pages/Settings/index?editProfile=true' })
  },
})
