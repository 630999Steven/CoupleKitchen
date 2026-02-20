const app = getApp()

Page({
  data: {
    appName: '',
    userName: '',
    partnerName: '',
    dishCount: 0,
    orderCount: 0,
    openid: '',
  },

  async onShow() {
    await this.getOpenId()
    this.loadAppInfo()
    await this.loadStats()
  },

  // 获取openid
  async getOpenId() {
    try {
      const res = await wx.cloud.callFunction({ name: 'getOpenId' })
      const openid = res.result?.openid || ''
      this.setData({ openid })
    } catch (e) {
      console.error('获取openid失败', e)
    }
  },

  // 加载应用信息
  loadAppInfo() {
    const isUserA = this.data.openid === app.globalData._openidA
    this.setData({
      appName: app.globalData.appName,
      userName: isUserA ? app.globalData.userA : app.globalData.userB,
      partnerName: isUserA ? app.globalData.userB : app.globalData.userA
    })
  },

  // 加载统计数据
  async loadStats() {
    try {
      const db = await app.database()

      const dishRes = await db.collection(app.globalData.collectionDishList).count()
      const orderRes = await db.collection(app.globalData.collectionOrderList).count()

      this.setData({
        dishCount: dishRes.total,
        orderCount: orderRes.total
      })
    } catch (e) {
      console.error('加载统计失败', e)
    }
  },

  // 请求订阅消息权限
  requestNotifyPermission() {
    // 订阅消息模板ID，需要在微信公众平台申请
    const tmplIds = ['lFy-3Kj2HTuid-KZDiBQMpKppVHAQsy7G3KargWX1GY']

    wx.requestSubscribeMessage({
      tmplIds,
      success: (res) => {
        if (res[tmplIds[0]] === 'accept') {
          wx.showToast({ title: '订阅成功', icon: 'success' })
        } else {
          wx.showToast({ title: '需要授权才能收到通知', icon: 'none' })
        }
      },
      fail: () => {
        wx.showToast({ title: '订阅失败', icon: 'none' })
      }
    })
  },

  // 复制微信号
  copyWechat() {
    wx.setClipboardData({
      data: 'your_wechat_id',
      success: () => {
        wx.showToast({ title: '已复制微信号', icon: 'success' })
      }
    })
  },
})
