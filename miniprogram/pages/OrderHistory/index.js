const app = getApp()

Page({
  data: {
    orders: [],
    loading: true,
    hasMore: true,
    page: 0,
    pageSize: 10,
    openid: '',
    partnerName: '',
    showTipModal: false,
    tipText: '',
  },

  async onShow() {
    await this.getOpenId()
    this.setPartnerName()
    await this.loadOrders(true)
  },

  // 设置伴侣名字
  setPartnerName() {
    const partnerName = app.getPartnerName(this.data.openid)
    this.setData({ partnerName })
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

  // 加载历史记录
  async loadOrders(reset = false) {
    if (reset) {
      this.setData({ page: 0, orders: [], hasMore: true })
    }

    this.setData({ loading: true })

    try {
      const db = await app.database()
      const { page, pageSize, orders: existingOrders } = this.data

      const res = await db.collection(app.globalData.collectionOrderList)
        .orderBy('createTime', 'desc')
        .skip(page * pageSize)
        .limit(pageSize)
        .get()

      const newOrders = res.data.map(item => ({
        ...item,
        dateText: this.formatDate(item.createTime),
        timeText: this.formatTime(item.createTime),
        creatorName: this.getCreatorName(item._openid),
        slideButtons: this.getSlideButtons(item.marked)
      }))

      this.setData({
        orders: reset ? newOrders : [...existingOrders, ...newOrders],
        hasMore: res.data.length === pageSize,
        page: page + 1,
        loading: false
      })
    } catch (e) {
      console.error('加载历史失败', e)
      this.setData({ loading: false })
    }
  },

  // 加载更多
  loadMore() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadOrders()
    }
  },

  // 获取创建者名字
  getCreatorName(openid) {
    if (openid === this.data.openid) return '你'
    return app.getPartnerName(this.data.openid)
  },

  // 格式化日期
  formatDate(date) {
    if (!date) return ''
    const d = new Date(date)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (d.toDateString() === today.toDateString()) {
      return '今天'
    } else if (d.toDateString() === yesterday.toDateString()) {
      return '昨天'
    } else {
      const month = (d.getMonth() + 1).toString().padStart(2, '0')
      const day = d.getDate().toString().padStart(2, '0')
      return `${month}月${day}日`
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

  // 获取滑动按钮配置
  getSlideButtons(marked) {
    return [
      { text: marked ? '取消' : '标记', type: 'default', extClass: 'mark-btn' },
      { text: '删除', type: 'warn', extClass: 'delete-btn' }
    ]
  },

  // 滑动按钮点击处理
  onSlideButtonTap(e) {
    const { index } = e.detail
    const id = e.currentTarget.dataset.id
    if (index === 0) {
      this.toggleMark(id)
    } else {
      this.deleteOrder(id)
    }
  },

  // 切换标记状态
  async toggleMark(id) {
    const orders = this.data.orders
    const index = orders.findIndex(item => item._id === id)
    if (index === -1) return

    const newMarked = !orders[index].marked
    try {
      const db = await app.database()
      const res = await db.collection(app.globalData.collectionOrderList).doc(id).update({
        data: { marked: newMarked }
      })
      if (res.stats.updated === 0) {
        this.showTip('只能标记自己点的菜哦~')
        return
      }
      orders[index].marked = newMarked
      orders[index].slideButtons = this.getSlideButtons(newMarked)
      this.setData({ orders })
      wx.showToast({ title: newMarked ? '已标记' : '已取消标记', icon: 'success' })
    } catch (e) {
      console.error('标记失败', e)
      this.showTip('标记失败了，再试一次吧~')
    }
  },

  // 删除订单
  deleteOrder(id) {
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条点菜记录吗？',
      confirmColor: '#E57373',
      success: async (res) => {
        if (res.confirm) {
          try {
            const db = await app.database()
            const result = await db.collection(app.globalData.collectionOrderList).doc(id).remove()
            if (result.stats.removed === 0) {
              setTimeout(() => this.showTip('只能删除自己点的菜哦~'), 300)
              return
            }
            wx.showToast({ title: '已删除', icon: 'success' })
            const orders = this.data.orders.filter(item => item._id !== id)
            this.setData({ orders })
          } catch (e) {
            console.error('删除失败', e)
            setTimeout(() => this.showTip('只能删除自己点的菜哦~'), 300)
          }
        }
      }
    })
  },

  // 显示提示弹窗
  showTip(text) {
    this.setData({ showTipModal: true, tipText: text })
  },

  // 关闭提示弹窗
  closeTipModal() {
    this.setData({ showTipModal: false })
  },

  // 阻止冒泡
  preventClose() {},

  // 跳转到详情页
  goToDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/OrderDetail/index?id=${id}` })
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadOrders(true).then(() => {
      wx.stopPullDownRefresh()
    })
  },

  // 上拉加载
  onReachBottom() {
    this.loadMore()
  },
})
