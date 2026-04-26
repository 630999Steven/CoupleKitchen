const app = getApp()

Page({
  data: {
    isBound: false,
    dishes: [],
    filteredDishes: [],
    search: '',
    loading: true,
    partnerName: '',
  },

  onShow() {
    app.setKitchenTitle()
    this.getPartnerName()
    this.loadDishes()
  },

  // 获取伴侣名字
  async getPartnerName() {
    try {
      const res = await wx.cloud.callFunction({ name: 'getOpenId' })
      const openid = res.result?.openid || ''
      const partnerName = app.getPartnerName(openid)
      this.setData({ partnerName })
    } catch (e) {
      console.error('获取伴侣名字失败', e)
    }
  },

  // 加载菜品列表
  async loadDishes() {
    this.setData({ loading: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'getCoupleData',
        data: {
          collection: app.globalData.collectionDishList,
          orderBy: 'createTime',
          order: 'desc',
          limit: 100
        }
      })
      if (!res.result?.success) {
        throw new Error(res.result?.message || '加载失败')
      }

      let dishes = res.result.data.map(item => ({
        ...item,
        createTimeText: this.formatDate(item.createTime)
      }))
      await app.convertFileURLs(dishes, ['imageUrl'])

      this.setData({
        dishes,
        filteredDishes: dishes,
        loading: false
      })
    } catch (e) {
      console.error('加载菜品失败', e)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  // 搜索
  onSearch(e) {
    const search = e.detail.value.trim()
    this.setData({ search })
    this.filterDishes()
  },

  // 过滤菜品
  filterDishes() {
    const { dishes, search } = this.data
    if (!search) {
      this.setData({ filteredDishes: dishes })
      return
    }
    const filtered = dishes.filter(item =>
      item.name.toLowerCase().includes(search.toLowerCase())
    )
    this.setData({ filteredDishes: filtered })
  },

  // 跳转到添加页
  toAddPage() {
    wx.navigateTo({ url: '/pages/DishAdd/index' })
  },

  // 跳转到详情页
  toDetailPage(e) {
    const id = e.currentTarget.dataset.id
    const dish = this.data.dishes.find(item => item._id === id)
    const imageUrl = dish?.imageUrl ? encodeURIComponent(dish.imageUrl) : ''
    wx.navigateTo({ url: `/pages/DishDetail/index?id=${id}&imageUrl=${imageUrl}` })
  },

  // 长按删除确认
  showDeleteConfirm(e) {
    const id = e.currentTarget.dataset.id
    const dish = this.data.dishes.find(item => item._id === id)

    wx.showModal({
      title: '删除菜品',
      content: `确定要删除「${dish.name}」吗？`,
      confirmColor: '#E53935',
      success: async (res) => {
        if (res.confirm) {
          await this.deleteDish(id)
        }
      }
    })
  },

  // 删除菜品
  async deleteDish(id) {
    wx.showLoading({ title: '删除中...', mask: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'updateCoupleData',
        data: {
          collection: app.globalData.collectionDishList,
          docId: id,
          action: 'remove'
        }
      })

      wx.hideLoading()

      if (!res.result?.success) {
        throw new Error(res.result?.message || '删除失败')
      }

      // 更新本地数据
      const dishes = this.data.dishes.filter(item => item._id !== id)
      this.setData({ dishes })
      this.filterDishes()

      wx.showToast({ title: '已删除', icon: 'success' })
    } catch (e) {
      wx.hideLoading()
      console.error('删除失败', e)
      wx.showToast({ title: '删除失败', icon: 'none' })
    }
  },

  // 格式化日期
  formatDate(date) {
    if (!date) return ''
    const d = new Date(date)
    const month = (d.getMonth() + 1).toString().padStart(2, '0')
    const day = d.getDate().toString().padStart(2, '0')
    return `${month}-${day}`
  },
})
