Component({
  data: {
    show: false,
    type: '' // 'profile' 或 'bind'
  },
  pageLifetimes: {
    show() {
      const app = getApp()
      if (!app) return
      if (!app.isProfileComplete()) {
        this.setData({ show: true, type: 'profile' })
      } else if (!app.isBound()) {
        this.setData({ show: true, type: 'bind' })
      } else {
        this.setData({ show: false, type: '' })
      }
    }
  },
  methods: {
    goToBind() {
      wx.navigateTo({ url: '/pages/Bind/index' })
    },
    goToSetProfile() {
      wx.navigateTo({ url: '/pages/Settings/index?editProfile=true' })
    }
  }
})
