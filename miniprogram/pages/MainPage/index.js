const app = getApp()

Page({
  data: {
    greeting: '你好',
    partnerName: '荔荔',
    todayOrder: null,
    dishCount: 0,
    orderCount: 0,
    togetherDays: 0,
    openid: '',
  },

  onLoad() {
    this.setGreeting()
  },

  async onShow() {
    await this.getOpenId()
    this.loadTodayOrder()
    this.loadStats()
    // 显示自己的名字
    const openid = this.data.openid
    const myName = openid === app.globalData._openidA ? app.globalData.userA : app.globalData.userB
    this.setData({ partnerName: myName })
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

  // 获取用户openid
  async getOpenId() {
    try {
      const res = await wx.cloud.callFunction({ name: 'getOpenId' })
      const openid = res.result?.openid || ''
      this.setData({ openid })
    } catch (e) {
      console.error('获取openid失败', e)
    }
  },

  // 加载今日点菜
  async loadTodayOrder() {
    try {
      const db = await app.database()
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const res = await db.collection(app.globalData.collectionOrderList)
        .where({
          createTime: db.command.gte(today)
        })
        .orderBy('createTime', 'desc')
        .limit(1)
        .get()

      if (res.data.length > 0) {
        const order = res.data[0]
        const isMe = order._openid === this.data.openid
        this.setData({
          todayOrder: {
            ...order,
            creatorName: isMe ? '你' : app.getPartnerName(this.data.openid),
            timeText: this.formatTime(order.createTime)
          }
        })
      } else {
        this.setData({ todayOrder: null })
      }
    } catch (e) {
      console.error('加载今日点菜失败', e)
    }
  },

  // 加载统计数据
  async loadStats() {
    try {
      const db = await app.database()

      // 菜品数量
      const dishRes = await db.collection(app.globalData.collectionDishList).count()
      // 点菜次数
      const orderRes = await db.collection(app.globalData.collectionOrderList).count()

      this.setData({
        dishCount: dishRes.total,
        orderCount: orderRes.total,
        togetherDays: orderRes.total > 0 ? Math.max(1, orderRes.total) : 0
      })
    } catch (e) {
      console.error('加载统计失败', e)
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
    const templateId = 'lFy-3Kj2HTuid-KZDiBQMpKppVHAQsy7G3KargWX1GY'

    wx.requestSubscribeMessage({
      tmplIds: [templateId],
      success: (res) => {
        if (res[templateId] === 'accept') {
          wx.showToast({ title: '订阅成功', icon: 'success' })
        } else {
          wx.showToast({ title: '订阅失败', icon: 'none' })
        }
      },
      fail: (err) => {
        console.error('订阅失败', err)
        wx.showToast({ title: '请先申请消息模板', icon: 'none' })
      }
    })
  },

  // 跳转到点菜页
  goToOrder() {
    wx.switchTab({ url: '/pages/Order/index' })
  },

  // 跳转到菜品库
  goToDishes() {
    wx.switchTab({ url: '/pages/Dishes/index' })
  },

  // 跳转到历史
  goToHistory() {
    wx.switchTab({ url: '/pages/OrderHistory/index' })
  },
})
