const app = getApp()

Page({
  data: {
    order: null,
    loading: true,
  },

  onLoad(options) {
    if (options.id) {
      this.loadOrder(options.id)
    }
  },

  async loadOrder(id) {
    try {
      const db = await app.database()
      const res = await db.collection(app.globalData.collectionOrderList).doc(id).get()
      const order = res.data
      order.dateText = this.formatDate(order.createTime)
      order.timeText = this.formatTime(order.createTime)
      order.creatorName = await this.getCreatorName(order._openid)
      this.setData({ order, loading: false })
    } catch (e) {
      console.error('加载订单失败', e)
      wx.showToast({ title: '加载失败', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  async getCreatorName(openid) {
    try {
      const res = await wx.cloud.callFunction({ name: 'getOpenId' })
      const myOpenid = res.result?.openid || ''
      if (openid === myOpenid) return '你'
      return app.getPartnerName(myOpenid)
    } catch (e) {
      return '对方'
    }
  },

  formatDate(date) {
    if (!date) return ''
    const d = new Date(date)
    const year = d.getFullYear()
    const month = (d.getMonth() + 1).toString().padStart(2, '0')
    const day = d.getDate().toString().padStart(2, '0')
    return `${year}年${month}月${day}日`
  },

  formatTime(date) {
    if (!date) return ''
    const d = new Date(date)
    const hours = d.getHours().toString().padStart(2, '0')
    const minutes = d.getMinutes().toString().padStart(2, '0')
    return `${hours}:${minutes}`
  },

  // 再来一单
  reorder() {
    const dishIds = this.data.order.dishes.map(d => d._id).join(',')
    wx.switchTab({
      url: '/pages/Order/index',
      success: () => {
        const app = getApp()
        app.globalData.reorderDishIds = dishIds
      }
    })
  },
})
