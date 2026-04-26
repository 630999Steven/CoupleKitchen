const app = getApp()

Page({
  data: {
    inviteCode: '',
    inputCode: '',
    nickname: '',
    avatarUrl: '',
    partnerNickname: '',
    partnerAvatarUrl: '',
    bindStatus: 'unbound',
    bindDays: 0,
    bindDate: '',
    dishCount: 0,
    orderCount: 0,
    kitchenName: '',
    tempKitchenName: '',
    showKitchenNameModal: false,
    loading: true,
    submitting: false,
    statusBarHeight: 20,
  },

  onLoad() {
    const sysInfo = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: sysInfo.statusBarHeight })
  },

  async onShow() {
    await this.loadUserInfo()

    // 如果有待绑定的邀请码（从分享链接进入），自动执行绑定
    if (app.globalData.pendingInviteCode && this.data.bindStatus !== 'bound') {
      this.setData({ inputCode: app.globalData.pendingInviteCode })
      app.globalData.pendingInviteCode = null
      setTimeout(() => this.bindPartner(), 500)
    }
  },

  // 加载用户信息
  async loadUserInfo() {
    this.setData({ loading: true })
    const { currentUser, partner } = await app.loadUserInfo()

    // 计算绑定天数和日期
    let bindDays = 0
    let bindDate = ''
    if (currentUser?.bindStatus === 'bound' && currentUser?.bindTime) {
      const bindTime = new Date(currentUser.bindTime)
      const now = new Date()
      bindDays = Math.floor((now - bindTime) / (1000 * 60 * 60 * 24)) + 1
      bindDate = `${bindTime.getFullYear()}年${bindTime.getMonth() + 1}月${bindTime.getDate()}日`
    }

    this.setData({
      loading: false,
      inviteCode: currentUser?.inviteCode || '',
      nickname: currentUser?.nickname || '',
      avatarUrl: currentUser?.avatarUrl || '',
      bindStatus: currentUser?.bindStatus || 'unbound',
      bindDays,
      bindDate,
      kitchenName: app.getKitchenName(),
      partnerNickname: partner?.nickname || '',
      partnerAvatarUrl: partner?.avatarUrl || ''
    })

    // 已绑定时加载统计数据
    if (currentUser?.bindStatus === 'bound') {
      this.loadStats()
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
        orderCount: orderRes.result?.total || 0
      })
    } catch (e) {
      console.error('loadStats error', e)
    }
  },

  // 输入邀请码
  onInputCode(e) {
    this.setData({ inputCode: e.detail.value.toUpperCase() })
  },

  // 绑定伴侣
  async bindPartner() {
    const { inputCode, submitting } = this.data
    if (submitting || !inputCode || inputCode.length !== 6) {
      wx.showToast({ title: '请输入6位邀请码', icon: 'none' })
      return
    }

    this.setData({ submitting: true })
    wx.showLoading({ title: '绑定中...', mask: true })

    const result = await app.bindPartner(inputCode)

    if (result.success) {
      // 刷新页面显示已绑定状态
      await app.loadUserInfo(true)
      await this.loadUserInfo()
      wx.hideLoading()
      wx.showToast({ title: '绑定成功', icon: 'success' })
      // 绑定成功后立即请求通知授权，为接收伴侣点菜通知积攒额度
      wx.requestSubscribeMessage({
        tmplIds: app.globalData.notifyTmplIds,
        complete: () => {}
      })
    } else {
      wx.hideLoading()
      wx.showToast({ title: result.message, icon: 'none' })
    }
    this.setData({ submitting: false })
  },

  // 解除绑定
  unbindPartner() {
    wx.showModal({
      title: '确认解绑',
      content: '解绑后你们将无法互相看到对方的点菜，确定要解绑吗？',
      confirmColor: '#E57373',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '解绑中...', mask: true })
          const result = await app.unbindPartner()
          if (result.success) {
            await this.loadUserInfo()
            wx.hideLoading()
            wx.showToast({ title: '已解绑', icon: 'success' })
          } else {
            wx.hideLoading()
            wx.showToast({ title: result.message, icon: 'none' })
          }
        }
      }
    })
  },

  // 复制邀请码
  copyInviteCode() {
    wx.setClipboardData({
      data: this.data.inviteCode,
      success: () => {
        wx.showToast({ title: '已复制邀请码', icon: 'success' })
      }
    })
  },

  // 分享邀请链接
  onShareAppMessage() {
    const { inviteCode, nickname } = this.data
    return {
      title: `${nickname || '我'}邀请你一起使用帕恰狗的小厨房`,
      path: `/pages/MainPage/index?inviteCode=${inviteCode}`,
      imageUrl: '/images/123.jpg'
    }
  },

  // 返回上一页
  goBack() {
    wx.navigateBack()
  },

  // 显示修改厨房名称弹窗
  showKitchenNameModal() {
    this.setData({
      showKitchenNameModal: true,
      tempKitchenName: this.data.kitchenName
    })
  },

  // 隐藏弹窗
  hideKitchenNameModal() {
    this.setData({ showKitchenNameModal: false })
  },

  // 阻止冒泡
  preventClose() {},

  // 输入厨房名称
  onKitchenNameInput(e) {
    let value = e.detail.value
    if (value.length > 8) value = value.slice(0, 8)
    this.setData({ tempKitchenName: value })
    return value
  },

  // 保存厨房名称
  async saveKitchenName() {
    const { tempKitchenName } = this.data
    if (!tempKitchenName.trim()) {
      wx.showToast({ title: '请输入厨房名称', icon: 'none' })
      return
    }
    if (tempKitchenName.length > 8) {
      wx.showToast({ title: '名称不能超过8个字', icon: 'none' })
      return
    }

    wx.showLoading({ title: '保存中...' })
    const result = await app.updateKitchenName(tempKitchenName.trim())
    wx.hideLoading()

    if (result.success) {
      this.setData({
        kitchenName: tempKitchenName.trim(),
        showKitchenNameModal: false
      })
      wx.showToast({ title: '保存成功', icon: 'success' })
    } else {
      wx.showToast({ title: result.message, icon: 'none' })
    }
  },
})
