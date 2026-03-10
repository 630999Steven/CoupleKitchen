const app = getApp()

Page({
  data: {
    appName: '',
    userName: '',
    userAvatar: '',
    partnerName: '',
    partnerAvatar: '',
    isBound: false,
    dishCount: 0,
    orderCount: 0,
    showEditModal: false,
    tempNickname: '',
    tempAvatarUrl: '',
    saving: false,
  },

  onLoad(options) {
    if (options.editProfile) {
      this._autoEditProfile = true
    }
  },

  async onShow() {
    await this.loadUserInfo()
    this.loadAppInfo()
    await this.loadStats()
    app.setKitchenTitle()
    if (this._autoEditProfile) {
      this._autoEditProfile = false
      this.openEditProfile()
    }
  },

  // 加载用户信息
  async loadUserInfo() {
    const { currentUser, partner } = await app.loadUserInfo()
    this.setData({
      userName: currentUser?.nickname || '未设置',
      userAvatar: currentUser?.avatarUrl || '',
      partnerName: partner?.nickname || '',
      partnerAvatar: partner?.avatarUrl || '',
      isBound: app.isBound()
    })
  },

  // 加载应用信息
  loadAppInfo() {
    this.setData({
      appName: app.getKitchenName()
    })
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
      console.error('load stats error', e)
    }
  },

  // 跳转到绑定页面
  goToBind() {
    wx.navigateTo({ url: '/pages/Bind/index' })
  },

  // 打开编辑个人信息弹窗
  openEditProfile() {
    this.setData({
      showEditModal: true,
      tempNickname: this.data.userName === '未设置' ? '' : this.data.userName,
      tempAvatarUrl: ''
    })
  },

  // 关闭编辑弹窗
  closeEditModal() {
    this.setData({ showEditModal: false })
  },

  // 阻止冒泡
  preventClose() {},

  // 选择头像
  onChooseAvatar(e) {
    this.setData({ tempAvatarUrl: e.detail.avatarUrl })
  },

  // 输入昵称
  onNicknameInput(e) {
    this.setData({ tempNickname: e.detail.value })
  },

  // 保存个人信息
  async saveProfile() {
    const { tempNickname, tempAvatarUrl, userAvatar, saving } = this.data
    if (saving) return

    const nickname = tempNickname.trim()
    if (!nickname) {
      wx.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }

    this.setData({ saving: true })
    wx.showLoading({ title: '保存中...', mask: true })

    try {
      let avatarUrl = userAvatar
      // 如果选择了新头像，上传到云存储
      if (tempAvatarUrl) {
        const cloudPath = `avatars/${Date.now()}-${Math.random().toString(36).substr(2)}.jpg`
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath,
          filePath: tempAvatarUrl
        })
        avatarUrl = uploadRes.fileID
      }

      // 调用云函数更新用户信息
      await wx.cloud.callFunction({
        name: 'createUser',
        data: { nickname, avatarUrl }
      })

      // 刷新用户信息
      await app.loadUserInfo(true)
      await this.loadUserInfo()

      wx.hideLoading()
      this.setData({ showEditModal: false })
      wx.showToast({ title: '保存成功', icon: 'success' })
    } catch (e) {
      wx.hideLoading()
      console.error('save profile error', e)
      wx.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      this.setData({ saving: false })
    }
  },

  // 请求订阅消息权限
  requestNotifyPermission() {
    wx.requestSubscribeMessage({
      tmplIds: app.globalData.notifyTmplIds,
      success: (res) => {
        if (res[app.globalData.notifyTmplIds[0]] === 'accept') {
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

})
