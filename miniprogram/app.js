App({
  async onLaunch() {
    this.initcloud()

    this.globalData = {
      // 情侣的openid
      _openidA: 'of98y3YO5xjP-jppRx4qe87U1pMA',  // 泡泡浴
      _openidB: 'of98y3c3p8_AduHK7Y2Vx5xtUgIM',  // 荔荔

      // 情侣的名字
      userA: '泡泡浴',
      userB: '荔荔',

      // 云数据库集合名称
      collectionDishList: 'DishList',      // 菜品库
      collectionOrderList: 'OrderList',    // 点菜记录

      // 应用信息
      appName: '帕恰狗的小厨房',
      version: '1.0.0',

      // 菜品分类
      categories: [
        { id: 'meat', name: '荤菜', icon: '🥩' },
        { id: 'vegetable', name: '素菜', icon: '🥬' },
        { id: 'soup', name: '汤类', icon: '🍲' },
        { id: 'rice', name: '主食', icon: '🍚' },
        { id: 'noodle', name: '面食', icon: '🍜' },
        { id: 'cold', name: '凉菜', icon: '🥗' },
        { id: 'dessert', name: '甜点', icon: '🍰' },
        { id: 'drink', name: '饮品', icon: '🥤' },
      ],
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

  // 获取当前用户身份
  getUserRole(openid) {
    if (openid === this.globalData._openidA) return 'A'
    if (openid === this.globalData._openidB) return 'B'
    return null
  },

  // 获取伴侣名字
  getPartnerName(openid) {
    if (openid === this.globalData._openidA) return this.globalData.userB
    if (openid === this.globalData._openidB) return this.globalData.userA
    return '对方'
  },
})
