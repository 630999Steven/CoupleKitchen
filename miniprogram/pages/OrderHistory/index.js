const app = getApp()

Page({
  data: {
    isBound: false,
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
    app.setKitchenTitle()
    await this.loadUserInfo()
    await this.loadOrders(true)
  },

  // 加载用户信息
  async loadUserInfo() {
    const { currentUser, partner } = await app.loadUserInfo()
    this.setData({
      openid: currentUser?._id || '',
      partnerName: partner?.nickname || '对方'
    })
  },

  // 加载历史记录
  async loadOrders(reset = false) {
    if (reset) {
      this.setData({ page: 0, orders: [], hasMore: true })
    }

    this.setData({ loading: true })

    try {
      const { page, pageSize, orders: existingOrders } = this.data

      const res = await wx.cloud.callFunction({
        name: 'getCoupleData',
        data: {
          collection: app.globalData.collectionOrderList,
          orderBy: 'createTime',
          order: 'desc',
          skip: page * pageSize,
          limit: pageSize
        }
      })

      if (!res.result?.success) {
        throw new Error(res.result?.message || '加载失败')
      }

      const data = res.result.data
      const newOrders = data.map(item => ({
        ...item,
        dateText: this.formatDate(item.createTime),
        timeText: this.formatTime(item.createTime),
        creatorName: this.getCreatorName(item._openid),
        slideButtons: this.getSlideButtons(item.marked)
      }))

      this.setData({
        orders: reset ? newOrders : [...existingOrders, ...newOrders],
        hasMore: data.length === pageSize,
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
    return app.getDisplayName(openid)
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
    wx.showLoading({ title: '处理中...', mask: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'updateCoupleData',
        data: {
          collection: app.globalData.collectionOrderList,
          docId: id,
          action: 'update',
          data: { marked: newMarked }
        }
      })

      wx.hideLoading()

      if (!res.result?.success) {
        this.showTip(res.result?.message || '标记失败')
        return
      }

      orders[index].marked = newMarked
      orders[index].slideButtons = this.getSlideButtons(newMarked)
      this.setData({ orders })
      wx.showToast({ title: newMarked ? '已标记' : '已取消标记', icon: 'success' })
    } catch (e) {
      wx.hideLoading()
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
          wx.showLoading({ title: '删除中...', mask: true })
          try {
            const result = await wx.cloud.callFunction({
              name: 'updateCoupleData',
              data: {
                collection: app.globalData.collectionOrderList,
                docId: id,
                action: 'remove'
              }
            })

            wx.hideLoading()

            if (!result.result?.success) {
              setTimeout(() => this.showTip(result.result?.message || '删除失败'), 300)
              return
            }

            wx.showToast({ title: '已删除', icon: 'success' })
            const orders = this.data.orders.filter(item => item._id !== id)
            this.setData({ orders })
          } catch (e) {
            wx.hideLoading()
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
    wx.requestSubscribeMessage({
      tmplIds: app.globalData.notifyTmplIds,
      complete: () => {
        wx.navigateTo({ url: `/pages/OrderDetail/index?id=${id}` })
      }
    })
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
